import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "dataset" / "data"

def load_jsonl(name):
    path = DATA / f"{name}.jsonl"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

orders = {o["id"]: o for o in load_jsonl("orders")}
plans = {p["id"]: p for p in load_jsonl("transport_plans")}
points = load_jsonl("transport_points")
segments = load_jsonl("transport_segments")
time_windows = load_jsonl("time_windows")
travel_res = load_jsonl("travel_reservations")
travel_opt = load_jsonl("travel_options")
assignments = load_jsonl("work_assignments")
alerts = load_jsonl("alerts")
documents = load_jsonl("documents")
proofs = load_jsonl("proofs")
endpoint_details = load_jsonl("order_endpoint_details")
claims = load_jsonl("endpoint_claims")
notes = load_jsonl("order_notes")
messages = load_jsonl("messages")
sites = {s["id"]: s for s in load_jsonl("sites")}
addresses = {a["id"]: a for a in load_jsonl("addresses")}
vehicles = {v["id"]: v for v in load_jsonl("vehicles")}
items = load_jsonl("order_items")
v_map = {}
for it in items:
    v_map[it["order_id"]] = vehicles.get(it.get("vehicle_id"), {})

manifest_path = ROOT / "attachments" / "manifest.json"
attachments = json.load(open(manifest_path, "r", encoding="utf-8")) if manifest_path.exists() else []

targets = ["ord-00123", "ord-00449", "ord-00458", "ord-00299", "ord-00399", "ord-00384", "ord-00702", "ord-00516", "ord-00347", "ord-00322", "ord-00194", "ord-00593", "ord-00154"]

for tid in targets:
    o = orders.get(tid, {})
    ref = o.get("reference")
    veh = v_map.get(tid, {})
    print(f"================================================================================")
    print(f"ORDER {tid} ({ref}) | {veh.get('make')} {veh.get('model')} | status={o.get('status')} | display_lane={o.get('display_lane')}")
    print(f"================================================================================")
    
    # Active plan points & time windows
    plan_id = o.get("active_plan_id")
    p_pts = [p for p in points if p.get("plan_id") == plan_id]
    for p in sorted(p_pts, key=lambda x: x.get("sequence_index", 0)):
        tw = [w for w in time_windows if w.get("point_id") == p.get("id")]
        site = sites.get(p.get("site_id"), {})
        addr = addresses.get(p.get("address_id"), {})
        print(f"  Point seq={p.get('sequence_index')}, kind={p.get('kind')}, city={addr.get('city')}, site={site.get('name')}")
        for w in tw:
            print(f"    TimeWindow: purpose={w.get('purpose')} start={w.get('start_at')} end={w.get('end_at')} is_selected={w.get('is_selected')} deadline={w.get('commitment_deadline_at')}")
    
    # Travel
    t_res = [r for r in travel_res if r.get("order_id") == tid]
    for r in t_res:
        print(f"  Travel Reservation: mode={r.get('mode')}, provider={r.get('provider')}, dep={r.get('departure_at')}, arr={r.get('arrival_at')}, status={r.get('status')}, ref={r.get('reference')}")
    t_opt = [r for r in travel_opt if r.get("order_id") == tid]
    for r in t_opt:
        print(f"  Travel Option: mode={r.get('mode')}, provider={r.get('provider')}, dep={r.get('departure_at')}, cost={r.get('cost_amount')} {r.get('cost_currency')}, status={r.get('status')}")
        
    # Alerts
    o_alerts = [a for a in alerts if a.get("order_id") == tid]
    for a in o_alerts:
        print(f"  Alert: signal={a.get('signal')}, status={a.get('status')}, sev={a.get('severity')}")
        print(f"    Summary: {a.get('summary')}")
        
    # Documents & Attachments
    o_docs = [d for d in documents if d.get("order_id") == tid]
    for d in o_docs:
        print(f"  Document: kind={d.get('kind')}, status={d.get('status')}")
    o_atts = [a for a in attachments if a.get("order_id") == tid]
    for a in o_atts:
        print(f"  Attachment: kind={a.get('kind')}, file={a.get('file_name')}, note={a.get('evidence_note')}")
        
    # Notes & Messages
    o_notes = [n for n in notes if n.get("order_id") == tid]
    for n in o_notes:
        print(f"  Note: {n.get('body')}")
    o_msgs = [m for m in messages if m.get("order_id") == tid]
    for m in o_msgs[-2:]:
        print(f"  Msg from {m.get('sender_role')}: {m.get('body')}")
    print()
