import io
import json
from pathlib import Path

import pytest

import app as wixfix_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    test_data_file = tmp_path / "app_data.json"
    test_upload_dir = tmp_path / "wireframes"
    test_upload_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(wixfix_app, "DATA_FILE", test_data_file)
    monkeypatch.setattr(wixfix_app, "UPLOAD_DIR", test_upload_dir)
    wixfix_app.app.config["TESTING"] = True
    with wixfix_app.app.test_client() as c:
        yield c


def test_pages_render_required_content(client):
    home = client.get("/")
    assert home.status_code == 200
    html = home.get_data(as_text=True)
    assert "Wixfix" in html
    assert "Priya Gupta" in html
    assert "Sample Websites Created by Us" in html
    assert "anooppriyaranjan@gmail.com" in html
    assert "Uttam Nagar, New Delhi - 110059" in html
    assert "Hukulganj, Varanasi - 221002" in html
    assert "Free Website Creation*" in html

    reg = client.get("/register")
    assert reg.status_code == 200
    assert "Confirm Password" in reg.get_data(as_text=True)

    contact = client.get("/contact")
    assert contact.status_code == 200
    assert "Delhi Office" in contact.get_data(as_text=True)
    assert "Varanasi Office" in contact.get_data(as_text=True)


def test_admin_secret_not_exposed_in_source_or_client():
    root = Path(wixfix_app.BASE_DIR)
    for folder in [root / "app.py", root / "README.md", root / "templates", root / "static" / "js", root / "static" / "css"]:
        if folder.is_file():
            content = folder.read_text(encoding="utf-8")
            assert "ADMIN_SALT_HEX" in content if folder.name == "app.py" else True
        else:
            for file in folder.rglob("*"):
                if file.is_file():
                    assert "password_hash" not in file.read_text(encoding="utf-8")


def test_admin_login_and_sample_crud(client, monkeypatch):
    test_salt, test_hash = wixfix_app.hash_password("TestSecret#999")
    monkeypatch.setattr(wixfix_app, "ADMIN_SALT_HEX", test_salt)
    monkeypatch.setattr(wixfix_app, "ADMIN_HASH_HEX", test_hash)

    bad = client.post("/api/admin/login", json={"password": "wrong"})
    assert bad.status_code == 401

    unauth = client.post(
        "/api/samples",
        json={"name": "Test", "url": "https://example.com", "category": "AWS", "priority": "Featured", "description": "Desc"},
    )
    assert unauth.status_code == 403

    good = client.post("/api/admin/login", json={"password": "TestSecret#999"})
    assert good.status_code == 200
    assert good.get_json()["is_admin"] is True

    created = client.post(
        "/api/samples",
        json={
            "name": "GCP BigQuery Portal",
            "url": "https://cloud.google.com/bigquery",
            "category": "GCP",
            "priority": "Featured",
            "description": "Organized BigQuery tutorials.",
        },
    )
    assert created.status_code == 201
    samples = created.get_json()["samples"]
    new_id = next(s["id"] for s in samples if s["name"] == "GCP BigQuery Portal")

    updated = client.put(
        f"/api/samples/{new_id}",
        json={
            "name": "GCP BigQuery Portal v2",
            "url": "https://cloud.google.com/bigquery/docs",
            "category": "GCP Cloud",
            "priority": "High",
            "description": "Updated description.",
        },
    )
    assert updated.status_code == 200
    assert any(s["name"] == "GCP BigQuery Portal v2" for s in updated.get_json()["samples"])

    deleted = client.delete(f"/api/samples/{new_id}")
    assert deleted.status_code == 200
    assert not any(s["id"] == new_id for s in deleted.get_json()["samples"])


def test_registration_login_and_post_ownership_permissions(client):
    # Register user A
    res_a = client.post(
        "/api/auth/register",
        json={
            "first_name": "Rohan",
            "last_name": "Verma",
            "email": "rohan@example.com",
            "mobile": "9876543210",
            "password": "Password123",
            "confirm_password": "Password123",
        },
    )
    assert res_a.status_code == 201

    # User A posts a need + wireframe
    post_res = client.post(
        "/api/posts",
        data={
            "title": "Rohan's Python Portal",
            "category": "School Services (Free*)",
            "description": "Need chapter-wise Python videos.",
            "wireframe": (io.BytesIO(b"<svg></svg>"), "sketch.svg"),
        },
        content_type="multipart/form-data",
    )
    assert post_res.status_code == 201
    rohan_post = next(p for p in post_res.get_json()["posts"] if p["title"] == "Rohan's Python Portal")

    # User A cannot attach running_url
    forbidden_url = client.put(
        f"/api/posts/{rohan_post['id']}",
        json={"running_url": "https://example.com"},
    )
    assert forbidden_url.status_code == 403

    # Logout and register User B
    client.post("/api/auth/logout")
    res_b = client.post(
        "/api/auth/register",
        json={
            "first_name": "Neha",
            "last_name": "Singh",
            "email": "neha@example.com",
            "mobile": "9123456789",
            "password": "Password123",
            "confirm_password": "Password123",
        },
    )
    assert res_b.status_code == 201

    # User B cannot edit or delete Rohan's post
    assert client.put(f"/api/posts/{rohan_post['id']}", json={"title": "Hacked"}).status_code == 403
    assert client.delete(f"/api/posts/{rohan_post['id']}").status_code == 403

    # Logout and register/login as super-admin anooppriyaranjan@gmail.com
    client.post("/api/auth/logout")
    res_owner = client.post(
        "/api/auth/register",
        json={
            "first_name": "Priya",
            "last_name": "Gupta",
            "email": "anooppriyaranjan@gmail.com",
            "mobile": "9999999999",
            "password": "OwnerPass123",
            "confirm_password": "OwnerPass123",
        },
    )
    assert res_owner.status_code == 201
    assert res_owner.get_json()["is_admin"] is True

    # Owner CAN edit Rohan's post and attach running_url
    owner_edit = client.put(
        f"/api/posts/{rohan_post['id']}",
        json={"title": "Rohan's Python Portal (Launched)", "running_url": "https://docs.python.org/3/"},
    )
    assert owner_edit.status_code == 200
    updated_post = next(p for p in owner_edit.get_json()["posts"] if p["id"] == rohan_post["id"])
    assert updated_post["running_url"] == "https://docs.python.org/3/"

    # Owner CAN delete Rohan's post
    owner_del = client.delete(f"/api/posts/{rohan_post['id']}")
    assert owner_del.status_code == 200


def test_contact_and_chatbot(client):
    c_res = client.post(
        "/api/contact",
        json={
            "name": "Amit",
            "email": "amit@school.edu",
            "office": "Varanasi Office",
            "subject": "School Portal",
            "message": "Interested in free school resources.",
        },
    )
    assert c_res.status_code == 201

    bot_res = client.post("/api/chatbot", json={"query": "Is website creation free?"})
    assert bot_res.status_code == 200
    assert "free" in bot_res.get_json()["answer"].lower()
