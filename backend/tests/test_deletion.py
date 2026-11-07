from tests.conftest import make_client, sql

PW = "correct horse"


async def _delete_me(c, password=PW):
    return await c.request("DELETE", "/api/auth/me", json={"password": password})


async def test_delete_requires_password(bob):
    r = await _delete_me(bob, "wrong")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "wrong_password"
    assert (await bob.get("/api/auth/me")).status_code == 200


async def test_delete_me_removes_everything_of_the_user(alice, bob):
    item = (
        await bob.post("/api/items", json={"url": "https://example.com/b", "tags": ["x"]})
    ).json()
    await bob.patch(f"/api/items/{item['id']}", json={"status": "seen"})
    r = await _delete_me(bob)
    assert r.status_code == 204
    assert (await bob.get("/api/auth/me")).status_code == 401
    assert await sql("SELECT 1 FROM users WHERE email = 'bob@example.com'") == []
    assert await sql("SELECT 1 FROM items") == []
    assert await sql("SELECT 1 FROM tags") == []
    assert await sql("SELECT 1 FROM item_events") == []
    async with make_client() as c:
        login = await c.post("/api/auth/login", json={"email": "bob@example.com", "password": PW})
        assert login.status_code == 401


async def test_items_shared_by_a_deleted_user_survive_without_sharer(alice, bob):
    item = (await bob.post("/api/items", json={"url": "https://example.com/b"})).json()
    await bob.post(f"/api/items/{item['id']}/share", json={"emails": ["alice@example.com"]})
    got = (await alice.get("/api/items", params={"shared": "true"})).json()["items"]
    assert got[0]["shared_by"]["email"] == "bob@example.com"

    assert (await _delete_me(bob)).status_code == 204
    after = (await alice.get("/api/items")).json()["items"]
    assert len(after) == 1 and after[0]["shared_by"] is None
    rows = await sql("SELECT shared_by_user_id FROM items")
    assert rows[0].shared_by_user_id is None
    # the sharer's `other_user_id` in alice's journal is nulled, the events themselves stay
    assert (await sql("SELECT other_user_id FROM item_events"))[0].other_user_id is None


async def test_last_admin_cannot_leave_while_others_exist(alice, bob):
    r = await _delete_me(alice)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "last_admin"
    assert (await alice.get("/api/auth/me")).status_code == 200


async def test_sole_account_can_delete_itself(alice):
    assert (await _delete_me(alice)).status_code == 204
    assert await sql("SELECT 1 FROM users") == []


async def test_admin_can_leave_when_another_admin_exists_and_invitations_stay(alice, bob):
    await alice.post("/api/admin/invitations", json={"email": "new@example.com"})
    await sql("UPDATE users SET role = 'admin' WHERE email = 'bob@example.com'")
    assert (await _delete_me(alice)).status_code == 204
    rows = await sql("SELECT created_by FROM invitations")
    assert len(rows) == 1 and rows[0].created_by is None


async def test_delete_requires_session(client):
    assert (await _delete_me(client)).status_code == 401
