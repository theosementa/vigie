"""Print the OpenAPI document: `python -m app.openapi_export > openapi.json`.

Builds the schema from the routes only: no database connection and no `SECRET_KEY` needed
(the secret check lives in the lifespan, which does not run here).
"""

import json

from app.main import app


def main() -> None:
    print(json.dumps(app.openapi(), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
