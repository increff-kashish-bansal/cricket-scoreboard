import csv
import random
import json
from datetime import datetime, timedelta

DEVS = ["Unni", "Virat", "SSR", "Ram", "Yukt"]
SPRINTS = ["Sprint 1", "Sprint 2", "Sprint 3"]
TEAMS = ["Backend", "Frontend", "Infra"]
PRIORITIES = ["P1", "P2", "P3"]
TAGS = ["bug", "feature", "enhancement", "performance", "infra"]
STATUSES = [
    "In Development", "Tech QC", "Business QC", "Blocked", "Blocked for Clarification",
    "In Review", "Released", "Deprioritized"
]

def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

def make_event_log(owner, created, status, closed=None, blocked_by=None):
    log = []
    t = created
    log.append({"status": "In Development", "timestamp": t.isoformat(), "user": owner})
    if status in ["Tech QC", "Business QC", "In Review"]:
        t += timedelta(hours=random.randint(8, 24))
        log.append({"status": "Tech QC", "timestamp": t.isoformat(), "user": random.choice(DEVS)})
    if status == "Business QC":
        t += timedelta(hours=random.randint(8, 24))
        log.append({"status": "Business QC", "timestamp": t.isoformat(), "user": random.choice(DEVS)})
    if status == "Blocked":
        t += timedelta(hours=random.randint(4, 12))
        log.append({"status": "Blocked", "timestamp": t.isoformat(), "user": blocked_by or random.choice(DEVS), "blockedBy": blocked_by or random.choice(DEVS)})
    if status == "Blocked for Clarification":
        t += timedelta(hours=random.randint(4, 12))
        log.append({"status": "Blocked for Clarification", "timestamp": t.isoformat(), "user": blocked_by or random.choice(DEVS), "blockedBy": blocked_by or random.choice(DEVS)})
    if status == "Released" and closed:
        t = closed
        log.append({"status": "Released", "timestamp": t.isoformat(), "user": owner})
    return json.dumps(log)

def main():
    random.seed(42)
    now = datetime(2024, 6, 1, 10, 0, 0)
    rows = []
    for i in range(1, 101):
        owner = random.choice(DEVS)
        assignee = random.choice(DEVS)
        reporter = random.choice(DEVS)
        sprint = random.choice(SPRINTS)
        team = random.choice(TEAMS)
        priority = random.choice(PRIORITIES)
        tag = random.choice(TAGS)
        status = random.choice(STATUSES)
        created = now + timedelta(days=random.randint(0, 30))
        closed = created + timedelta(days=random.randint(2, 10)) if status == "Released" else ""
        blocked = random.choice([True, False]) if status.startswith("Blocked") else False
        blocked_by = random.choice([d for d in DEVS if d != owner]) if blocked else ""
        blocked_since = (created + timedelta(days=random.randint(1, 3))).isoformat() if blocked else ""
        unblocked_at = (created + timedelta(days=random.randint(2, 4))).isoformat() if blocked else ""
        event_log = make_event_log(owner, created, status, closed if closed else None, blocked_by if blocked else None)
        time_in_dev = random.randint(5, 20)
        time_in_tech_qc = random.randint(0, 5) if status in ["Tech QC", "Business QC", "Released"] else 0
        time_in_biz_qc = random.randint(0, 5) if status in ["Business QC", "Released"] else 0
        time_in_backlog = random.randint(0, 3)
        time_in_blocked = random.randint(0, 2) if blocked else 0
        total_cycle = time_in_dev + time_in_tech_qc + time_in_biz_qc + time_in_backlog + time_in_blocked
        code_review_count = random.randint(0, 3)
        revision_count = random.randint(0, 2)
        release_version = f"1.0.{random.randint(0, 5)}"
        row = [
            i,
            f"Ticket {i}",
            f"Description for ticket {i}",
            status,
            created.isoformat(),
            closed.isoformat() if closed else "",
            sprint,
            team,
            owner,
            assignee,
            reporter,
            str(blocked).upper(),
            blocked_by,
            blocked_since,
            unblocked_at,
            event_log,
            time_in_dev,
            time_in_tech_qc,
            time_in_biz_qc,
            time_in_backlog,
            time_in_blocked,
            total_cycle,
            priority,
            tag,
            code_review_count,
            revision_count,
            release_version
        ]
        rows.append(row)

    header = [
        "id","title","description","status","createdOn","closedOn","sprint","team","owner","assignee","reporter",
        "blocked","blockedBy","Blocked_Since","Unblocked_At","Event_Log","timeInDevelopmentHours","timeInTechQCHours",
        "timeInBusinessQCHours","timeInSprintBacklogHours","timeInBlockedforClarificationHours","totalCycleTimeHours",
        "priority","tags","codeReviewCount","revisionCount","releaseVersion"
    ]
    with open("public/ticket.csv", "w", newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

if __name__ == "__main__":
    main() 