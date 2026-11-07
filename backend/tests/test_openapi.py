from app.main import app

METHODS = {"get", "post", "put", "patch", "delete"}


def _operations():
    spec = app.openapi()
    for path, item in spec["paths"].items():
        for method, op in item.items():
            if method in METHODS:
                yield path, method, op


def test_operation_ids_are_unique_and_descriptive():
    ids = [op["operationId"] for _, _, op in _operations()]
    assert len(ids) == len(set(ids))
    assert all(i.islower() or "_" in i for i in ids)
    assert not any("_api_" in i for i in ids)  # FastAPI's default id embeds the path
    assert {"list_items", "create_item", "get_stats_summary", "list_item_events"} <= set(ids)


def test_every_success_response_is_typed():
    for path, method, op in _operations():
        successes = {c: r for c, r in op["responses"].items() if c.startswith("2")}
        assert successes, (method, path)
        for code, resp in successes.items():
            if code == "204":
                assert "content" not in resp, (method, path)
            elif "text/event-stream" in resp.get("content", {}):
                continue  # the live-updates stream: documented in API.md, not JSON
            else:
                schema = resp.get("content", {}).get("application/json", {}).get("schema")
                assert schema, (method, path)  # not an untyped body


def test_error_schema_is_shared():
    schemas = app.openapi()["components"]["schemas"]
    assert set(schemas["ErrorDetail"]["properties"]) == {"code", "message"}
    assert schemas["ErrorResponse"]["properties"]["detail"]["$ref"].endswith("/ErrorDetail")


def test_enums_are_string_unions():
    schemas = app.openapi()["components"]["schemas"]
    assert schemas["Locale"]["enum"] == ["auto", "en", "fr"]
    assert schemas["Theme"]["enum"] == ["system", "dark", "light"]
    assert "EventKind" in schemas
