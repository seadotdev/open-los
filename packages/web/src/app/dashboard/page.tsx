"use client";

import { useEffect, useState, useCallback } from "react";
import { Nav } from "@/components/Nav";
import { DemoGuard, useDemoClient } from "@/components/DemoGuard";
import type { Deal, Entity, AuditEvent } from "@/lib/api";

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function StageBoard({ deals }: { deals: Deal[] }) {
  const stages = ["broker", "origination", "underwriting", "closing", "monitoring"];

  return (
    <div style={{ display: "flex", gap: "12px", overflowX: "auto", padding: "4px 0" }}>
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);
        return (
          <div
            key={stage}
            style={{
              flex: "1 0 200px",
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius)",
              padding: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span className={`stage-badge stage-${stage}`}>{stage}</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {stageDeals.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {stageDeals.map((deal) => (
                <div
                  key={deal.id}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "4px",
                    }}
                  >
                    {deal.borrower_name}
                  </div>
                  {deal.requested_amount && (
                    <div
                      className="amount"
                      style={{ color: "var(--text-secondary)", fontSize: "12px" }}
                    >
                      {formatAmount(deal.requested_amount)}
                    </div>
                  )}
                  {deal.purpose && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                      }}
                    >
                      {deal.purpose}
                    </div>
                  )}
                </div>
              ))}
              {stageDeals.length === 0 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  No deals
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityFeed({ deals, client }: { deals: Deal[]; client: ReturnType<typeof useDemoClient> }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    if (!client || deals.length === 0) return;
    // Fetch audit events for first few deals
    Promise.all(
      deals.slice(0, 3).map((d) => client.listAuditEvents(d.id, { limit: 5 }).catch(() => ({ events: [] })))
    ).then((results) => {
      const all = results
        .flatMap((r) => r.events)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setEvents(all.slice(0, 20));
    });
  }, [client, deals]);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Activity Feed</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        {events.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No recent activity
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--accent)",
                marginTop: "6px",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px" }}>
                <span style={{ color: "var(--info)" }}>{event.actor}</span>{" "}
                <span style={{ color: "var(--text-secondary)" }}>{event.action}</span>{" "}
                <span>{event.object_type}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardContent() {
  const client = useDemoClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!client) return;
    try {
      const [dealsRes, entitiesRes] = await Promise.all([
        client.listDeals(),
        client.listEntities(),
      ]);
      setDeals(dealsRes.deals || []);
      setEntities(entitiesRes.entities || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <span className="spinner" style={{ width: "32px", height: "32px" }} />
      </div>
    );
  }

  const totalExposure = deals.reduce((sum, d) => sum + (d.requested_amount || 0), 0);
  const stageCounts = deals.reduce(
    (acc, d) => {
      acc[d.stage] = (acc[d.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="container" style={{ padding: "24px" }}>
      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: "24px" }}>
        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Deals
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700 }}>{deals.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Total Exposure
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {formatAmount(totalExposure)}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Entities
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700 }}>{entities.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
            In Underwriting
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--warning)" }}>
            {stageCounts.underwriting || 0}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <span className="card-title">Pipeline</span>
          <button className="btn btn-secondary" style={{ fontSize: "12px", padding: "4px 12px" }} onClick={loadData}>
            Refresh
          </button>
        </div>
        <StageBoard deals={deals} />
      </div>

      {/* Activity + Deals Table */}
      <div className="grid-2">
        <ActivityFeed deals={deals} client={client} />

        <div className="card">
          <div className="card-header">
            <span className="card-title">All Deals</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Stage</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.borrower_name}</td>
                  <td>
                    <span className={`stage-badge stage-${deal.stage}`}>{deal.stage}</span>
                  </td>
                  <td className="amount">
                    {deal.requested_amount ? formatAmount(deal.requested_amount) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <Nav active="Dashboard" />
      <DemoGuard>
        <DashboardContent />
      </DemoGuard>
    </div>
  );
}
