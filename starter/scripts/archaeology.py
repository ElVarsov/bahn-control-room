import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "dataset" / "data"

def load_jsonl(name):
    path = DATA / f"{name}.jsonl"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

def main():
    orders = {o["id"]: o for o in load_jsonl("orders")}
    proposals = load_jsonl("agent_proposals")
    alerts = load_jsonl("alerts")
    incidents = load_jsonl("incidents")
    messages = load_jsonl("messages")
    conversations = {c["id"]: c for c in load_jsonl("conversations")}
    notes = load_jsonl("order_notes")
    claims = load_jsonl("endpoint_claims")
    details = {d["id"]: d for d in load_jsonl("order_endpoint_details")}
    addresses = {a["id"]: a for a in load_jsonl("addresses")}
    sites = {s["id"]: s for s in load_jsonl("sites")}
    vehicles = {v["id"]: v for v in load_jsonl("vehicles")}
    items = load_jsonl("order_items")
    reservations = load_jsonl("travel_reservations")
    options = load_jsonl("travel_options")
    proofs = load_jsonl("proofs")
    documents = load_jsonl("documents")
    work_items = load_jsonl("work_items")
    attachments = json.load(open(ROOT / "attachments" / "manifest.json", "r", encoding="utf-8"))

    print("=" * 80)
    print("DEEP DATA ARCHAEOLOGY: BAHN CAR DELIVERY CONTROL ROOM")
    print("=" * 80)
    print(f"Total Orders: {len(orders)} | Alerts: {len(alerts)} | Proposals: {len(proposals)} | Incidents: {len(incidents)} | Attachments: {len(attachments)}")
    print()

    # 1. Existing Proposals
    print("--- 1. AGENT PROPOSALS IN SNAPSHOT (14 proposals across 11 orders) ---")
    prop_by_order = defaultdict(list)
    for p in proposals:
        prop_by_order[p["order_id"]].append(p)
    for ord_id, plist in prop_by_order.items():
        o = orders.get(ord_id, {})
        print(f"Order {ord_id} ({o.get('reference')}): {len(plist)} proposal(s)")
        for p in plist:
            print(f"  - [{p.get('status')}] Command: {p.get('command')}")
            print(f"    Summary: {p.get('summary')}")
            print(f"    Rationale: {p.get('rationale')}")
            print(f"    Payload: {p.get('proposed_payload')}")
            print(f"    Evidence Refs: {p.get('evidence_refs')}")
        print()

    # 2. Alerts Breakdown
    print("--- 2. ALL ALERTS WITH SIGNALS AND SUMMARIES ---")
    alert_types = defaultdict(list)
    for a in alerts:
        alert_types[a.get("signal")].append(a)
    for signal, alist in alert_types.items():
        print(f"Signal: {signal} ({len(alist)} total)")
        for a in alist:
            o = orders.get(a.get("order_id"), {})
            print(f"  - {o.get('reference')} ({a.get('order_id')}): status={a.get('status')} severity={a.get('severity')}")
            print(f"    Summary: {a.get('summary')}")
            print(f"    Evidence: {a.get('evidence_refs')}")
        print()

    # 3. Incidents
    print("--- 3. ALL INCIDENTS ---")
    for inc in incidents:
        o = orders.get(inc.get("order_id"), {})
        print(f"Incident {inc.get('id')} on {o.get('reference')} ({inc.get('order_id')}): kind={inc.get('kind')} status={inc.get('status')} owner={inc.get('owner')}")
    print()

    # 4. Contradictions & Claims
    print("--- 4. ENDPOINT CLAIMS AND ADDRESS CONTRADICTIONS ---")
    for c in claims:
        o = orders.get(c.get("order_id"), {})
        print(f"Claim on {o.get('reference')} ({c.get('order_id')}): field='{c.get('field')}' claim='{c.get('claim')}' source={c.get('source_type')} confidence={c.get('confidence')} status={c.get('resolution_status')}")
    print()

    # Check order notes and messages for cities
    print("--- 5. NOTES AND MESSAGES CITY / ADDRESS CHECKS ---")
    for o in orders.values():
        ord_id = o["id"]
        ref = o["reference"]
        p_addr = addresses.get(o.get("pickup_address_id"), {})
        d_addr = addresses.get(o.get("delivery_address_id"), {})
        d_city = d_addr.get("city", "")
        
        ord_notes = [n for n in notes if n.get("order_id") == ord_id]
        ord_msgs = [m for m in messages if m.get("order_id") == ord_id]
        
        for n in ord_notes:
            body = n.get("body", "")
            if any(k in body.lower() for k in ["tampere", "helsinki", "vantaa", "espoo", "turku", "oulu"]):
                print(f"Note mentioning Finnish city on {ref} (Delivery City in address: '{d_city}'):")
                print(f"  '{body}'")
        for m in ord_msgs:
            body = m.get("body", "")
            if "tampere" in body.lower() and "helsinki" in d_city.lower():
                print(f"Message on {ref} with Tampere vs Helsinki:")
                print(f"  '{body}'")
            elif "helsinki" in body.lower() and "tampere" in d_city.lower():
                print(f"Message on {ref} with Helsinki vs Tampere:")
                print(f"  '{body}'")

    print()
    print("--- 6. ORDER VEHICLES MAPPING ---")
    order_veh = {}
    for it in items:
        v = vehicles.get(it.get("vehicle_id"))
        if v:
            order_veh[it["order_id"]] = f"{v.get('make')} {v.get('model')} ({v.get('registration_plate') or v.get('vin')})"
    for a in alerts:
        o = orders.get(a.get("order_id"), {})
        ref = o.get("reference")
        veh_name = order_veh.get(a.get("order_id"), "Unknown")
        print(f"Alert {a.get('signal')} -> {ref}: {veh_name} | Alert: {a.get('summary')}")

if __name__ == "__main__":
    main()
