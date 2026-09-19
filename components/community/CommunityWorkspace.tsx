"use client";

import { PageHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/SeverityChip";
import { ClinicFinder } from "@/components/community/ClinicFinder";
import { MedicationTalk } from "@/components/community/MedicationTalk";

/**
 * /community — DESIGN_SYSTEM.md rev 3 "Community page composition":
 * page header row, then a 12-column grid with "Find a clinic" (5) beside "Medication talk" (7).
 * Below lg the two panels stack; both are always mounted so state survives resizing.
 */
export function CommunityWorkspace() {
  return (
    <div className="pb-8">
      <PageHeader
        title="People near you"
        subtitle="Find a clinic that takes your coverage, and hear what others say about their medicines."
        actions={
          <StatusPill tone="neutral" className="h-8 px-3">
            <span role="note">Anonymous · public · not medical advice</span>
          </StatusPill>
        }
      />
      <div className="grid grid-cols-12 gap-6 items-start">
        <ClinicFinder className="col-span-12 lg:col-span-5" />
        <MedicationTalk className="col-span-12 lg:col-span-7" />
      </div>
    </div>
  );
}
