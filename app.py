import hashlib
import hmac
import json
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from urllib.parse import urlparse

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "app_data.json"
SECRET_KEY_FILE = DATA_DIR / ".secret_key"
UPLOAD_DIR = BASE_DIR / "static" / "uploads" / "wireframes"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_WIREFRAME_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"}
SUPER_ADMIN_EMAIL = "anooppriyaranjan@gmail.com"

# One-way salted PBKDF2-HMAC-SHA256 verification parameters (200,000 iterations).
# Plaintext password is never stored anywhere in the codebase or data files.
ADMIN_SALT_HEX = "82e70d13eb99a755bc68446cd6c553b9"
ADMIN_HASH_HEX = "f00d40fba61d9e499324cff729ea03c552a210837f2a683efd033c81b4ad19f3"
PBKDF2_ITERATIONS = 200_000

_DATA_LOCK = threading.Lock()


def _load_or_create_secret_key() -> str:
    if SECRET_KEY_FILE.exists():
        key = SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
        if key:
            return key
    key = secrets.token_hex(32)
    SECRET_KEY_FILE.write_text(key, encoding="utf-8")
    return key


app = Flask(__name__)
app.config["SECRET_KEY"] = _load_or_create_secret_key()
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB max wireframe upload


def hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    """Hash a password using salted PBKDF2-HMAC-SHA256."""
    if salt_hex is None:
        salt_hex = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        PBKDF2_ITERATIONS,
    ).hex()
    return salt_hex, digest


def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    """Verify a password in constant time against a salted PBKDF2-HMAC-SHA256 hash."""
    _, candidate = hash_password(password, salt_hex)
    return hmac.compare_digest(candidate, expected_hash_hex)


def verify_admin_password(password: str) -> bool:
    return verify_password(password, ADMIN_SALT_HEX, ADMIN_HASH_HEX)


def is_valid_http_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def normalize_priority(priority: str) -> str:
    mapping = {
        "featured": "Featured",
        "high": "High",
        "standard": "Standard",
    }
    return mapping.get((priority or "").strip().lower(), "Standard")


def priority_rank(priority: str) -> int:
    order = {"Featured": 0, "High": 1, "Standard": 2}
    return order.get(normalize_priority(priority), 3)


def _default_data() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "samples": [
            {
                "id": "smp-cloud-01",
                "name": "Cloud & DevOps Mastery Hub (AWS + GCP)",
                "url": "https://aws.amazon.com/training/",
                "category": "AWS & GCP Cloud",
                "priority": "Featured",
                "description": (
                    "Turns 90+ scattered YouTube cloud tutorials into a clean module-by-module portal "
                    "paired with official AWS Well-Architected & GCP documentation study cards."
                ),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "smp-msdn-02",
                "name": "C# & .NET Full-Stack Structured Portal",
                "url": "https://learn.microsoft.com/en-us/dotnet/",
                "category": "MSDN / .NET",
                "priority": "High",
                "description": (
                    "Topic-wise video curriculum indexing beginner-to-advanced C# lessons alongside "
                    "curated MSDN reference notes, lab checklists, and interview Q&A."
                ),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "smp-school-03",
                "name": "K-12 STEM & Python Starter Academy",
                "url": "https://docs.python.org/3/tutorial/",
                "category": "School Services (Free)",
                "priority": "Standard",
                "description": (
                    "Free school-level study portal organizing foundational Python, Algebra, and Web "
                    "basics from YouTube into distraction-free chapter playlists for students."
                ),
                "created_at": now,
                "updated_at": now,
            },
        ],
        "posts": [
            {
                "id": "post-demo-01",
                "title": "Class 10 Science & Coding Consolidated Portal",
                "category": "School Services",
                "description": (
                    "We need a clean chapter-wise portal linking curated Physics & Python YouTube "
                    "lessons with downloadable revision notes and practice quizzes for 200+ students."
                ),
                "wireframe_url": "/static/img/sample-wireframe.svg",
                "wireframe_name": "class10-portal-wireframe.svg",
                "running_url": "https://learn.microsoft.com/en-us/training/",
                "author_email": SUPER_ADMIN_EMAIL,
                "author_name": "Priya Gupta",
                "created_at": now,
                "updated_at": now,
            }
        ],
        "users": [],
        "inquiries": [],
    }


def _read_data() -> dict:
    with _DATA_LOCK:
        if not DATA_FILE.exists():
            data = _default_data()
            DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return data
        try:
            raw = DATA_FILE.read_text(encoding="utf-8")
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("Invalid JSON root")
            for key in ("samples", "posts", "users", "inquiries"):
                data.setdefault(key, [])
            return data
        except Exception:
            data = _default_data()
            DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return data


def _write_data(data: dict) -> None:
    with _DATA_LOCK:
        tmp_file = DATA_FILE.with_suffix(".tmp")
        tmp_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp_file.replace(DATA_FILE)


def get_current_user() -> dict | None:
    user_session = session.get("user")
    if not user_session or not isinstance(user_session, dict):
        return None
    email = (user_session.get("email") or "").strip().lower()
    if not email:
        return None
    return {
        "email": email,
        "first_name": user_session.get("first_name", ""),
        "last_name": user_session.get("last_name", ""),
        "full_name": f"{user_session.get('first_name', '')} {user_session.get('last_name', '')}".strip()
        or email,
        "is_super_admin": email == SUPER_ADMIN_EMAIL,
    }


def is_admin_active() -> bool:
    user = get_current_user()
    return bool(session.get("is_admin") or (user and user["is_super_admin"]))


def sorted_samples(samples: list[dict]) -> list[dict]:
    return sorted(
        samples,
        key=lambda item: (
            priority_rank(item.get("priority", "Standard")),
            item.get("created_at", ""),
        ),
    )


def enrich_posts_for_client(posts: list[dict], current_user: dict | None, admin_active: bool) -> list[dict]:
    user_email = current_user["email"] if current_user else None
    enriched = []
    for post in reversed(posts):
        author_email = (post.get("author_email") or "").strip().lower()
        can_edit = bool(admin_active or (user_email and user_email == author_email))
        enriched.append(
            {
                **post,
                "can_edit": can_edit,
                "can_delete": can_edit,
                "can_set_running_url": admin_active,
            }
        )
    return enriched


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin_active():
            return jsonify({"ok": False, "error": "Admin authentication required."}), 403
        return fn(*args, **kwargs)

    return wrapper


def login_required_api(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not get_current_user():
            return jsonify({"ok": False, "error": "Please sign in first."}), 401
        return fn(*args, **kwargs)

    return wrapper


@app.context_processor
def inject_globals():
    data = _read_data()
    samples = sorted_samples(data["samples"])
    current_user = get_current_user()
    admin_active = is_admin_active()
    return {
        "site_name": "Wixfix",
        "owner_name": "Priya Gupta",
        "company_email": SUPER_ADMIN_EMAIL,
        "delhi_office": "Plot No. 136, Bhagwati Garden Extension, Uttam Nagar, New Delhi - 110059",
        "varanasi_office": "S 10/203-19, Hukulganj, Varanasi - 221002",
        "current_user": current_user,
        "is_admin": admin_active,
        "featured_samples": samples,
    }


@app.route("/")
def home():
    data = _read_data()
    samples = sorted_samples(data["samples"])
    current_user = get_current_user()
    admin_active = is_admin_active()
    posts = enrich_posts_for_client(data["posts"], current_user, admin_active)
    initial_section = request.args.get("section", "overview")
    return render_template(
        "index.html",
        samples=samples,
        posts=posts,
        inquiries=list(reversed(data.get("inquiries", []))) if admin_active else [],
        initial_section=initial_section,
    )


@app.route("/register")
def register_page():
    if get_current_user():
        return redirect(url_for("home"))
    return render_template("register.html")


@app.route("/contact")
def contact_page():
    return render_template("contact.html")


@app.route("/api/state")
def api_state():
    data = _read_data()
    current_user = get_current_user()
    admin_active = is_admin_active()
    samples = sorted_samples(data["samples"])
    posts = enrich_posts_for_client(data["posts"], current_user, admin_active)
    return jsonify(
        {
            "ok": True,
            "user": current_user,
            "is_admin": admin_active,
            "samples": samples,
            "posts": posts,
            "inquiries": list(reversed(data.get("inquiries", []))) if admin_active else [],
        }
    )


@app.route("/api/auth/register", methods=["POST"])
def api_register():
    payload = request.get_json(silent=True) or {}
    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    mobile = (payload.get("mobile") or "").strip()
    password = payload.get("password") or ""
    confirm_password = payload.get("confirm_password") or ""

    if not all([first_name, last_name, email, mobile, password, confirm_password]):
        return jsonify({"ok": False, "error": "All registration fields are required."}), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"ok": False, "error": "Please enter a valid Email ID."}), 400
    digits = "".join(ch for ch in mobile if ch.isdigit())
    if len(digits) < 10 or len(digits) > 15:
        return jsonify({"ok": False, "error": "Please enter a valid 10–15 digit mobile number."}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "error": "Password must be at least 6 characters long."}), 400
    if password != confirm_password:
        return jsonify({"ok": False, "error": "Password and Confirm Password do not match."}), 400

    data = _read_data()
    if any((u.get("email") or "").lower() == email for u in data["users"]):
        return jsonify({"ok": False, "error": "An account with this Email ID already exists."}), 409

    salt_hex, password_hash = hash_password(password)
    new_user = {
        "id": f"usr-{uuid.uuid4().hex[:10]}",
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "mobile": mobile,
        "salt": salt_hex,
        "password_hash": password_hash,
        "role": "super_admin" if email == SUPER_ADMIN_EMAIL else "member",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    data["users"].append(new_user)
    _write_data(data)

    session["user"] = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
    }
    if email == SUPER_ADMIN_EMAIL:
        session["is_admin"] = True

    return jsonify(
        {
            "ok": True,
            "user": get_current_user(),
            "is_admin": is_admin_active(),
            "message": "Account created and signed in successfully.",
        }
    ), 201


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"ok": False, "error": "Email ID and password are required."}), 400

    data = _read_data()
    user_record = next((u for u in data["users"] if (u.get("email") or "").lower() == email), None)
    if not user_record or not verify_password(
        password, user_record.get("salt", ""), user_record.get("password_hash", "")
    ):
        return jsonify({"ok": False, "error": "Invalid Email ID or password."}), 401

    session["user"] = {
        "email": email,
        "first_name": user_record.get("first_name", ""),
        "last_name": user_record.get("last_name", ""),
    }
    if email == SUPER_ADMIN_EMAIL:
        session["is_admin"] = True

    return jsonify(
        {
            "ok": True,
            "user": get_current_user(),
            "is_admin": is_admin_active(),
        }
    )


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    session.pop("user", None)
    session.pop("is_admin", None)
    return jsonify({"ok": True})


@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""
    if not password:
        return jsonify({"ok": False, "error": "Admin password is required."}), 400
    if not verify_admin_password(password):
        return jsonify({"ok": False, "error": "Invalid Admin password."}), 401

    session["is_admin"] = True
    return jsonify({"ok": True, "is_admin": True})


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    session.pop("is_admin", None)
    return jsonify({"ok": True, "is_admin": is_admin_active()})


@app.route("/api/samples", methods=["POST"])
@admin_required
def api_create_sample():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    url = (payload.get("url") or "").strip()
    category = (payload.get("category") or "").strip()
    priority = normalize_priority(payload.get("priority", "Standard"))
    description = (payload.get("description") or "").strip()

    if not all([name, url, category, description]):
        return jsonify({"ok": False, "error": "All sample website fields are required."}), 400
    if not is_valid_http_url(url):
        return jsonify({"ok": False, "error": "Please enter a valid http:// or https:// URL."}), 400

    now = datetime.now(timezone.utc).isoformat()
    sample = {
        "id": f"smp-{uuid.uuid4().hex[:8]}",
        "name": name,
        "url": url,
        "category": category,
        "priority": priority,
        "description": description,
        "created_at": now,
        "updated_at": now,
    }
    data = _read_data()
    data["samples"].append(sample)
    _write_data(data)

    return jsonify({"ok": True, "sample": sample, "samples": sorted_samples(data["samples"])}), 201


@app.route("/api/samples/<sample_id>", methods=["PUT"])
@admin_required
def api_update_sample(sample_id: str):
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    url = (payload.get("url") or "").strip()
    category = (payload.get("category") or "").strip()
    priority = normalize_priority(payload.get("priority", "Standard"))
    description = (payload.get("description") or "").strip()

    if not all([name, url, category, description]):
        return jsonify({"ok": False, "error": "All sample website fields are required."}), 400
    if not is_valid_http_url(url):
        return jsonify({"ok": False, "error": "Please enter a valid http:// or https:// URL."}), 400

    data = _read_data()
    target = next((s for s in data["samples"] if s["id"] == sample_id), None)
    if not target:
        return jsonify({"ok": False, "error": "Sample website not found."}), 404

    target["name"] = name
    target["url"] = url
    target["category"] = category
    target["priority"] = priority
    target["description"] = description
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_data(data)

    return jsonify({"ok": True, "sample": target, "samples": sorted_samples(data["samples"])})


@app.route("/api/samples/<sample_id>", methods=["DELETE"])
@admin_required
def api_delete_sample(sample_id: str):
    data = _read_data()
    before = len(data["samples"])
    data["samples"] = [s for s in data["samples"] if s["id"] != sample_id]
    if len(data["samples"]) == before:
        return jsonify({"ok": False, "error": "Sample website not found."}), 404
    _write_data(data)
    return jsonify({"ok": True, "samples": sorted_samples(data["samples"])})


@app.route("/api/posts", methods=["POST"])
@login_required_api
def api_create_post():
    current_user = get_current_user()
    admin_active = is_admin_active()

    title = (request.form.get("title") or "").strip()
    category = (request.form.get("category") or "Custom Portal").strip()
    description = (request.form.get("description") or "").strip()
    running_url = (request.form.get("running_url") or "").strip()

    if not title or not description:
        return jsonify({"ok": False, "error": "Project title and description of need are required."}), 400

    if running_url:
        if not admin_active:
            return jsonify({"ok": False, "error": "Only Admin can attach a running web application URL."}), 403
        if not is_valid_http_url(running_url):
            return jsonify({"ok": False, "error": "Running URL must start with http:// or https://."}), 400

    wireframe_url = ""
    wireframe_name = ""
    file = request.files.get("wireframe")
    if file and file.filename:
        original = secure_filename(file.filename)
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_WIREFRAME_EXTENSIONS:
            return jsonify(
                {
                    "ok": False,
                    "error": "Wireframe must be an image (.png, .jpg, .jpeg, .webp, .svg, .gif) or .pdf.",
                }
            ), 400
        saved_name = f"{uuid.uuid4().hex[:10]}_{original}"
        file.save(UPLOAD_DIR / saved_name)
        wireframe_url = f"/static/uploads/wireframes/{saved_name}"
        wireframe_name = original

    now = datetime.now(timezone.utc).isoformat()
    post = {
        "id": f"post-{uuid.uuid4().hex[:8]}",
        "title": title,
        "category": category,
        "description": description,
        "wireframe_url": wireframe_url,
        "wireframe_name": wireframe_name,
        "running_url": running_url if admin_active else "",
        "author_email": current_user["email"],
        "author_name": current_user["full_name"],
        "created_at": now,
        "updated_at": now,
    }
    data = _read_data()
    data["posts"].append(post)
    _write_data(data)

    return jsonify(
        {
            "ok": True,
            "posts": enrich_posts_for_client(data["posts"], current_user, admin_active),
        }
    ), 201


@app.route("/api/posts/<post_id>", methods=["PUT"])
@login_required_api
def api_update_post(post_id: str):
    current_user = get_current_user()
    admin_active = is_admin_active()
    data = _read_data()
    post = next((p for p in data["posts"] if p["id"] == post_id), None)
    if not post:
        return jsonify({"ok": False, "error": "Post not found."}), 404

    is_owner = (post.get("author_email") or "").lower() == current_user["email"]
    if not (admin_active or is_owner):
        return jsonify({"ok": False, "error": "You can only edit your own posts."}), 403

    payload = request.get_json(silent=True) or {}
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"ok": False, "error": "Title cannot be empty."}), 400
        post["title"] = title
    if "category" in payload:
        post["category"] = (payload.get("category") or "Custom Portal").strip()
    if "description" in payload:
        desc = (payload.get("description") or "").strip()
        if not desc:
            return jsonify({"ok": False, "error": "Description cannot be empty."}), 400
        post["description"] = desc

    if "running_url" in payload:
        if not admin_active:
            return jsonify({"ok": False, "error": "Only Admin can set or edit the running web application URL."}), 403
        rurl = (payload.get("running_url") or "").strip()
        if rurl and not is_valid_http_url(rurl):
            return jsonify({"ok": False, "error": "Running URL must start with http:// or https://."}), 400
        post["running_url"] = rurl

    post["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_data(data)
    return jsonify(
        {
            "ok": True,
            "posts": enrich_posts_for_client(data["posts"], current_user, admin_active),
        }
    )


@app.route("/api/posts/<post_id>", methods=["DELETE"])
@login_required_api
def api_delete_post(post_id: str):
    current_user = get_current_user()
    admin_active = is_admin_active()
    data = _read_data()
    post = next((p for p in data["posts"] if p["id"] == post_id), None)
    if not post:
        return jsonify({"ok": False, "error": "Post not found."}), 404

    is_owner = (post.get("author_email") or "").lower() == current_user["email"]
    if not (admin_active or is_owner):
        return jsonify({"ok": False, "error": "You can only delete your own posts."}), 403

    data["posts"] = [p for p in data["posts"] if p["id"] != post_id]
    _write_data(data)
    return jsonify(
        {
            "ok": True,
            "posts": enrich_posts_for_client(data["posts"], current_user, admin_active),
        }
    )


@app.route("/api/contact", methods=["POST"])
def api_contact():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()
    office = (payload.get("office") or "New Delhi Office").strip()
    subject = (payload.get("subject") or "").strip()
    message = (payload.get("message") or "").strip()

    if not all([name, email, message]):
        return jsonify({"ok": False, "error": "Name, Email, and Message are required."}), 400

    inquiry = {
        "id": f"inq-{uuid.uuid4().hex[:8]}",
        "name": name,
        "email": email,
        "phone": phone,
        "office": office,
        "subject": subject or "Website Inquiry",
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    data = _read_data()
    data["inquiries"].append(inquiry)
    _write_data(data)
    return jsonify({"ok": True, "message": "Thank you! Your inquiry has been sent to Priya Gupta's team at Wixfix."}), 201


@app.route("/api/chatbot", methods=["POST"])
def api_chatbot():
    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    if not query:
        return jsonify({"ok": False, "answer": "Type any question about Wixfix, free school portals, MSDN/AWS/GCP tracks, or sample sites."})

    q = query.lower()
    data = _read_data()
    samples = sorted_samples(data["samples"])

    # Search live sample websites first
    matched_samples = [
        s
        for s in samples
        if any(word in f"{s['name']} {s['category']} {s['description']}".lower() for word in q.split() if len(word) > 2)
    ]

    links = []
    if any(k in q for k in ("price", "cost", "free", "charge", "fee", "school", "speaker", "premium")):
        answer = (
            "Wixfix provides **free website creation*** for school-level educational resources and organized topic lists! "
            "For advanced, personalized, or speaker-led learning modules and complex custom applications, we charge a small, "
            "affordable fee tailored to customer needs (*see footer note)."
        )
        links.append({"label": "View Pricing & Offerings", "section": "pricing"})
    elif any(k in q for k in ("contact", "office", "delhi", "varanasi", "address", "email", "priya", "owner")):
        answer = (
            "**Wixfix** is led by Company Owner **Priya Gupta** (`anooppriyaranjan@gmail.com`).\n"
            "• **Delhi Office**: Plot No. 136, Bhagwati Garden Extension, Uttam Nagar, New Delhi - 110059\n"
            "• **Varanasi Office**: S 10/203-19, Hukulganj, Varanasi - 221002"
        )
        links.append({"label": "Open Contact Page", "href": "/contact"})
    elif any(k in q for k in ("wireframe", "request", "post", "need", "upload", "submit", "url", "build")):
        answer = (
            "Sign in with your account (or register from the login popup), then open **Request Your Website (Need & Wireframe)** "
            "from the left menu. You can describe your need and upload a wireframe image/PDF. Once built, the Admin attaches "
            "the live running web app URL right below the embedded preview!"
        )
        links.append({"label": "Post a Website Request", "section": "request"})
    elif any(k in q for k in ("msdn", "aws", "gcp", "youtube", "video", "study", "how")):
        answer = (
            "Students often get lost in scattered YouTube playlists. Wixfix consolidates those video lessons topic-wise and pairs "
            "each module with structured study items from **MSDN**, **AWS**, and **GCP** documentation."
        )
        links.append({"label": "Explore MSDN / AWS / GCP Hub", "section": "study-hub"})
    elif any(k in q for k in ("register", "signup", "login", "account", "password")):
        answer = (
            "Click **Login / Register** in the top bar (or use the launch popup). New users can click the registration link below "
            "the password field to register with First Name, Last Name, Email ID, Mobile Number, and Password."
        )
        links.append({"label": "Go to Registration", "href": "/register"})
    elif any(k in q for k in ("admin", "panel", "dashboard")):
        answer = (
            "The **Admin Panel** lets authorized administrators add, edit, or delete Sample Websites with Priority tags "
            "(instantly synced to the middle dashboard and footer) and attach running Web App URLs to user project requests."
        )
        links.append({"label": "Open Sample Websites", "section": "samples"})
    elif matched_samples:
        top = matched_samples[0]
        answer = (
            f"We found a matching Wixfix portal: **{top['name']}** ({top['category']}) — {top['description']}"
        )
        links.append({"label": f"Visit {top['name']}", "href": top["url"], "external": True})
    else:
        answer = (
            "Hi! I'm the **Wixfix** Search Assistant. Wixfix turns scattered YouTube tutorials and MSDN/AWS/GCP resources into "
            "clean, structured student portals — with **free*** starter websites for schools and affordable speaker-led modules. "
            "Try asking about *pricing*, *MSDN/AWS/GCP*, *wireframes*, *sample sites*, or *office locations*."
        )
        links.append({"label": "Browse Sample Websites", "section": "samples"})

    if matched_samples and not any(l.get("external") for l in links):
        for s in matched_samples[:2]:
            links.append({"label": f"Open: {s['name']}", "href": s["url"], "external": True})

    return jsonify({"ok": True, "answer": answer, "links": links})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
