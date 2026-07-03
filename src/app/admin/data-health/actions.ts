"use server";

import {
  clearDataHealthCenterCache,
  loadDataHealthCenter,
  loadDataHealthSection,
} from "@/lib/admin/load-data-health-center";

export async function refreshDataHealthCenterAction() {
  clearDataHealthCenterCache();
  return loadDataHealthCenter({ bypassCache: true });
}

export async function loadDataHealthSectionAction(sectionId: string) {
  return loadDataHealthSection(sectionId);
}
