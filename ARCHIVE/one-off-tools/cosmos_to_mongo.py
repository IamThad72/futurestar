import os
import sys
from typing import Any, Dict, List, Optional, Tuple

from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError
from pymongo import MongoClient, errors


def read_env(name: str, default: Optional[str] = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(2)
    return value


def env_flag(name: str) -> bool:
    value = os.environ.get(name, "").strip().lower()
    return value in {"1", "true", "yes", "y"}


def get_partition_key_paths(container) -> List[str]:
    try:
        props = container.read()
        pk = props.get("partitionKey", {})
        return pk.get("paths", []) or []
    except CosmosHttpResponseError:
        return []


def get_value_by_path(doc: Dict[str, Any], path: str) -> Optional[Any]:
    # path format: "/tenant/id"
    parts = [p for p in path.strip("/").split("/") if p]
    cur: Any = doc
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def build_mongo_id(
    doc: Dict[str, Any], id_mode: str, pk_paths: List[str]
) -> Optional[Any]:
    if id_mode == "none":
        return None

    cosmos_id = doc.get("id")
    if id_mode == "id" or not pk_paths:
        return cosmos_id

    pk_values: List[str] = []
    for path in pk_paths:
        value = get_value_by_path(doc, path)
        if value is None:
            return cosmos_id
        pk_values.append(str(value))

    if cosmos_id is None:
        return None
    return f"{cosmos_id}|" + "|".join(pk_values)


def export_container(
    database,
    container_id: str,
    mongo_collection_name: str,
    mongo_uri: str,
    mongo_db: str,
    batch_size: int,
    id_mode: str,
) -> Tuple[int, int]:
    container = database.get_container_client(container_id)
    pk_paths = get_partition_key_paths(container)

    mongo_client = MongoClient(mongo_uri)
    collection = mongo_client[mongo_db][mongo_collection_name]

    buffer: List[Dict[str, Any]] = []
    total = 0
    seen = 0

    print(f"Starting export from Cosmos container: {container_id}")
    items_iter = container.read_all_items(max_item_count=batch_size)
    for item in items_iter:
        seen += 1
        doc = dict(item)
        if "_id" not in doc:
            mongo_id = build_mongo_id(doc, id_mode, pk_paths)
            if mongo_id is not None:
                doc["_id"] = mongo_id

        buffer.append(doc)
        if len(buffer) >= batch_size:
            try:
                result = collection.insert_many(buffer, ordered=False)
                total += len(result.inserted_ids)
            except errors.BulkWriteError as exc:
                # Ignore duplicate key errors and continue.
                total += exc.details.get("nInserted", 0)
            buffer.clear()
            print(f"{container_id}: processed {seen}, inserted {total}")

    if buffer:
        try:
            result = collection.insert_many(buffer, ordered=False)
            total += len(result.inserted_ids)
        except errors.BulkWriteError as exc:
            total += exc.details.get("nInserted", 0)

    print(f"{container_id}: done. Read {seen}, inserted {total}.")
    return seen, total


def main() -> None:
    cosmos_endpoint = read_env("COSMOS_ENDPOINT")
    cosmos_key = read_env("COSMOS_KEY")
    cosmos_db = os.environ.get("COSMOS_DB", "").strip()
    cosmos_container = os.environ.get("COSMOS_CONTAINER", "").strip()

    list_dbs = env_flag("LIST_DBS")
    list_containers = env_flag("LIST_CONTAINERS")
    all_containers = env_flag("ALL_CONTAINERS")

    cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
    if list_dbs:
        print("Databases:")
        for db in cosmos_client.list_databases():
            print(f"- {db.get('id')}")
        return

    if list_containers:
        if not cosmos_db:
            print("Missing required env var: COSMOS_DB", file=sys.stderr)
            sys.exit(2)
        database = cosmos_client.get_database_client(cosmos_db)
        print(f"Containers in {cosmos_db}:")
        for container_props in database.list_containers():
            print(f"- {container_props.get('id')}")
        return

    if not cosmos_db:
        print("Missing required env var: COSMOS_DB", file=sys.stderr)
        sys.exit(2)

    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    mongo_db = os.environ.get("MONGO_DB", cosmos_db)
    batch_size = int(os.environ.get("BATCH_SIZE", "500"))
    id_mode = os.environ.get("ID_MODE", "id_pk").lower().strip()
    if id_mode not in {"id_pk", "id", "none"}:
        print("ID_MODE must be one of: id_pk, id, none", file=sys.stderr)
        sys.exit(2)

    database = cosmos_client.get_database_client(cosmos_db)

    if all_containers:
        print(f"Exporting all containers in {cosmos_db}...")
        for container_props in database.list_containers():
            container_id = container_props.get("id")
            if not container_id:
                continue
            export_container(
                database=database,
                container_id=container_id,
                mongo_collection_name=container_id,
                mongo_uri=mongo_uri,
                mongo_db=mongo_db,
                batch_size=batch_size,
                id_mode=id_mode,
            )
        return

    if not cosmos_container:
        print("Missing required env var: COSMOS_CONTAINER", file=sys.stderr)
        sys.exit(2)

    mongo_collection = os.environ.get("MONGO_COLLECTION", cosmos_container)
    export_container(
        database=database,
        container_id=cosmos_container,
        mongo_collection_name=mongo_collection,
        mongo_uri=mongo_uri,
        mongo_db=mongo_db,
        batch_size=batch_size,
        id_mode=id_mode,
    )


if __name__ == "__main__":
    main()
