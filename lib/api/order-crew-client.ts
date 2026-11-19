import { crewOrdersApi, providerOrdersApi } from "@/components/api/ApiRoutesFile";
import { deleteData, getData, postData, putData } from "@/components/api/sliceHttp";
import type { DeviceLocation } from "@/lib/geolocation";
import type { OrderCrew } from "@/lib/types/provider-order";

/**
 * Crew on Fixed Service Orders — the Pro assigns employees / contractors (same model as jobs),
 * and assigned crew check in / out on site from their portal.
 */

function dataOf(response: unknown) {
  const root = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  return root.data !== undefined ? root.data : response;
}

function asCrew(value: unknown): OrderCrew {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    employees: Array.isArray(rec.employees) ? (rec.employees as OrderCrew["employees"]) : [],
    contractors: Array.isArray(rec.contractors) ? (rec.contractors as OrderCrew["contractors"]) : [],
    lastActor: (rec.lastActor as OrderCrew["lastActor"]) ?? null,
  };
}

export async function getOrderCrew(orderId: string): Promise<OrderCrew> {
  return asCrew(dataOf(await getData(providerOrdersApi.crew(orderId), undefined, { silent: true, force: true })));
}

/** Set the order's employees (adds and removes; the API refuses to remove anyone who started). */
export async function setOrderEmployees(orderId: string, employeeIds: string[]): Promise<OrderCrew> {
  return asCrew(dataOf(await putData(providerOrdersApi.crewEmployees(orderId), { employeeIds }, { silent: true })));
}

export async function removeOrderEmployee(orderId: string, employeeId: string): Promise<OrderCrew> {
  return asCrew(dataOf(await deleteData(providerOrdersApi.crewEmployee(orderId, employeeId), { silent: true })));
}

export async function assignOrderContractor(
  orderId: string,
  input: { contractorId: string; title: string; instructions: string; startAt: string; endAt: string },
): Promise<OrderCrew> {
  return asCrew(dataOf(await postData(providerOrdersApi.crewContractors(orderId), input, { silent: true })));
}

export async function removeOrderContractor(orderId: string, contractorId: string): Promise<OrderCrew> {
  return asCrew(dataOf(await deleteData(providerOrdersApi.crewContractor(orderId, contractorId), { silent: true })));
}

/** Pro: approve the crew's completion — the order goes to the customer for sign-off. */
export async function approveOrderCompletion(orderId: string, note = "") {
  return dataOf(await postData(providerOrdersApi.completionApprove(orderId), { note }, { silent: true }));
}

/** Pro: send the crew's completion back for re-work. */
export async function rejectOrderCompletion(orderId: string, note = "") {
  return dataOf(await postData(providerOrdersApi.completionReject(orderId), { note }, { silent: true }));
}

/** Pro: completed order → draft invoice; returns the new invoice's id. */
export async function convertOrderToInvoice(orderId: string): Promise<{ id: string; number: string }> {
  const data = dataOf(await postData(providerOrdersApi.convertToInvoice(orderId), {}, { silent: true }));
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return { id: String(rec._id || rec.id || ""), number: String(rec.number || "") };
}

export type CrewPortal = "technician" | "contractor";

/** Crew check-in on the order (on site, 200 m geofence). */
export async function crewOrderCheckIn(portal: CrewPortal, orderId: string, location: DeviceLocation | null, notes = "") {
  return dataOf(
    await postData(crewOrdersApi(portal).checkIn(orderId), { ...(location || {}), notes }, { silent: true }),
  );
}

/** Crew check-out of the order (on site). */
export async function crewOrderCheckOut(portal: CrewPortal, orderId: string, location: DeviceLocation | null, notes = "") {
  return dataOf(
    await postData(crewOrdersApi(portal).checkOut(orderId), { ...(location || {}), notes }, { silent: true }),
  );
}

/** One fixed-price order as the crew's merged Jobs list shows it. */
export type CrewOrderListRow = {
  id: string;
  orderNumber: string;
  title: string;
  category: string;
  status: string;
  customerName: string;
  customerPhone: string;
  address: string;
  scheduledAt: string | null;
  /** When this worker was assigned (newest first in the merged list). */
  assignedAt: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Orders assigned to the signed-in crew member (up to 50, newest assignment first). */
export async function listCrewOrders(portal: CrewPortal, limit = 50): Promise<CrewOrderListRow[]> {
  const data = dataOf(await getData(crewOrdersApi(portal).list, { page: 1, limit }, { silent: true, force: true }));
  const rows = Array.isArray(data) ? data : [];
  return rows.map((raw) => {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const service = (row.serviceSnapshot || {}) as Record<string, unknown>;
    const customer = (row.customerId && typeof row.customerId === "object" ? row.customerId : {}) as Record<string, unknown>;
    const addr = (row.address || {}) as Record<string, unknown>;
    const booking = (row.bookingId && typeof row.bookingId === "object" ? row.bookingId : {}) as Record<string, unknown>;
    return {
      id: text(row.id) || String(row._id || ""),
      orderNumber: text(row.orderNumber),
      title: text(service.servicesName),
      category: [text(service.categoryName), text(service.subcategoryName)].filter(Boolean).join(" · "),
      status: text(row.status),
      customerName: `${text(customer.firstName)} ${text(customer.lastName)}`.trim(),
      customerPhone: text(customer.phone),
      address: [text(addr.address) || text(addr.street), text(addr.city), [text(addr.state), text(addr.zip)].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      scheduledAt: text(booking.startTime) || null,
      assignedAt: text(row.crewAssignedAt) || text(row.createdAt) || null,
    };
  });
}

/** Open orders assigned to the signed-in crew member (portal nav badge). */
export async function getCrewOpenOrderCount(portal: CrewPortal): Promise<number> {
  const data = dataOf(await getData(crewOrdersApi(portal).count, undefined, { silent: true, force: true }));
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return Number(rec.open) || 0;
}
