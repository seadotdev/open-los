"use client";

import { useEffect, useState } from "react";
import { ApiClient } from "@/lib/api";

/**
 * Ensures a demo tenant is provisioned before rendering children.
 * Stores token in sessionStorage so it persists across page navigations.
 */
export function DemoGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = sessionStorage.getItem("demo_token");
    if (existing) {
      setReady(true);
      return;
    }

    // Auto-provision
    const client = new ApiClient();
    client
      .provisionDemo()
      .then((result) => {
        sessionStorage.setItem("demo_token", result.token);
        sessionStorage.setItem("demo_tenant_id", result.tenant_id);
        sessionStorage.setItem("demo_api_url", result.api_url);
        sessionStorage.setItem("demo_actor", result.actor);
        setReady(true);
      })
      .catch((err) => {
        setError(err.message || "Failed to provision demo tenant");
      });
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <p style={{ color: "var(--danger)" }}>Failed to connect to demo server</p>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <span className="spinner" style={{ width: "32px", height: "32px" }} />
        <p style={{ color: "var(--text-secondary)" }}>Provisioning demo sandbox...</p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to get the configured API client for the current demo session.
 */
export function useDemoClient(): ApiClient | null {
  const [client, setClient] = useState<ApiClient | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("demo_token");
    const apiUrl = sessionStorage.getItem("demo_api_url");
    const tenantId = sessionStorage.getItem("demo_tenant_id");
    const actor = sessionStorage.getItem("demo_actor");

    if (token) {
      setClient(
        new ApiClient({
          baseUrl: apiUrl || undefined,
          token,
          tenantId: tenantId || undefined,
          actor: actor || undefined,
        })
      );
    }
  }, []);

  return client;
}
