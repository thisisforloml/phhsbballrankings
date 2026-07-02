import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadAdminPlayerFilterContext } from "@/lib/admin/load-admin-player-filter-context";
import { loadManagedPlayerListPage } from "@/lib/admin/load-managed-player-list";
import { requireAdminUser } from "@/lib/portal-auth";

import { PlayerManagementClient } from "./PlayerManagementClient";



export const metadata = {

  title: "Players | Admin",

  description: "Edit player profiles.",

};



type PageProps = {

  searchParams?: {

    search?: string;

    program?: string;

    gender?: string;

    ageBracket?: string;

    page?: string;

    player?: string;

  };

};



function parsePage(value: string | undefined) {

  const parsed = Number.parseInt(value ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

}



export default async function AdminPlayersPage({ searchParams }: PageProps) {

  const filters = {

    search: searchParams?.search?.trim() ?? "",

    program: searchParams?.program ?? "All",

    gender: searchParams?.gender ?? "All",

    ageBracket: searchParams?.ageBracket ?? "All",

  };

  const page = parsePage(searchParams?.page);

  const [, listResult, filterContext] = await Promise.all([
    requireAdminUser(),
    loadManagedPlayerListPage(filters, page),
    loadAdminPlayerFilterContext(),
  ]);



  return (

    <>

      <AdminPageHeader title="Players" statusBadge={`${listResult.totalPlayers} records`} />

      <Suspense fallback={null}>

        <PlayerManagementClient

          players={listResult.players}

          programs={filterContext.programs}

          schoolOptions={filterContext.schoolOptions}

          filteredCount={listResult.filteredCount}

          page={listResult.page}

          totalPages={listResult.totalPages}

          pageSize={listResult.pageSize}

          initialSelectedPlayerId={searchParams?.player ?? ""}

        />

      </Suspense>

    </>

  );

}

