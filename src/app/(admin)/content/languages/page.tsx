"use client";

// §3.3 Content Management — Supported languages. Enable/disable controls which
// languages appear in the mobile language picker and counselor onboarding.
// Writes are no-ops against local state; wire to /api/lea/admin/language/*.

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Button,
  Input,
  Badge,
  ScaffoldNote,
  Table,
  Thead,
  Th,
  Tr,
  Td,
} from "@/components/ui";
import { LANGUAGES } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { SupportedLanguage } from "@/lib/types";

export default function LanguagesPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content.write");

  const [rows, setRows] = useState<SupportedLanguage[]>(LANGUAGES);
  const [addOpen, setAddOpen] = useState(false);

  function toggle(code: string) {
    // TODO: PATCH /api/lea/admin/language/{code} { enabled }
    // Disabled languages are hidden from the mobile language picker and counselor onboarding.
    setRows((prev) => prev.map((l) => (l.code === code ? { ...l, enabled: !l.enabled } : l)));
  }

  return (
    <div>
      <PageHeader
        title="Languages"
        prd="§3.3"
        description="Supported app languages. Disabled languages are hidden from the mobile picker and counselor onboarding."
        actions={
          <>
            <Link href="/content">
              <Button variant="secondary">← Back to content</Button>
            </Link>
            <Button variant="primary" disabled={!canWrite} onClick={() => setAddOpen(true)}>
              Add language
            </Button>
          </>
        }
      />

      <ScaffoldNote>
        Language data is mocked. Enable/disable updates local state only — wire to /api/lea/admin/language/*.
      </ScaffoldNote>

      <Table>
        <Thead>
          <Tr>
            <Th>Code</Th>
            <Th>Display name</Th>
            <Th>Enabled</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <tbody>
          {rows.map((l) => (
            <Tr key={l.code}>
              <Td>
                <span className="font-mono text-slate-700">{l.code}</span>
              </Td>
              <Td>{l.displayName}</Td>
              <Td>
                <Badge tone={l.enabled ? "green" : "neutral"}>{l.enabled ? "Enabled" : "Disabled"}</Badge>
              </Td>
              <Td>
                <Button variant="secondary" disabled={!canWrite} onClick={() => toggle(l.code)}>
                  {l.enabled ? "Disable" : "Enable"}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      {addOpen && <AddLanguageModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddLanguageModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Add language</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Backend and mobile string resources must be in place before a new language can be enabled. New languages start
          disabled.
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Code (ISO 639-1)</p>
            <Input value={code} onChange={setCode} placeholder="e.g. pt" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Display name</p>
            <Input value={displayName} onChange={setDisplayName} placeholder="e.g. Português" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              // TODO: POST /api/lea/admin/language
              onClose();
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
