import { userApi } from "@/components/api/ApiRoutesFile";
import { getData, postData } from "@/components/api/apiFuntions";

export type CustomerChangeOrder = {
  id: string;
  jobId: string;
  jobNumber: string;
  number: string;
  title: string;
  description: string;
  amount: number;
  items: Array<{
    id?: string;
    description: string;
    kind?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
    unit?: string;
  }>;
  status: string;
  customerNotes?: string;
  customerNote?: string;
  attachments?: string[];
  approvedBy?: string;
  approvedAt?: string | null;
  rejectedBy?: string;
  rejectedAt?: string | null;
  sentAt?: string | null;
  requestedAt?: string | null;
  customerName?: string;
  propertyAddress?: string;
};

function unwrapList(response: unknown): CustomerChangeOrder[] {
  const root = response as {
    data?: { changeOrders?: CustomerChangeOrder[] } | CustomerChangeOrder[];
    changeOrders?: CustomerChangeOrder[];
  };
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.data?.changeOrders)) return root.data.changeOrders;
  if (Array.isArray(root?.changeOrders)) return root.changeOrders;
  return [];
}

function unwrapOne(response: unknown): CustomerChangeOrder | null {
  const root = response as {
    data?: CustomerChangeOrder;
    success?: boolean;
  };
  return root?.data || null;
}

export async function listCustomerChangeOrders(status?: string) {
  const response = await getData(
    userApi.changeOrders,
    status ? { status } : undefined,
    { silent: true, force: true },
  );
  return unwrapList(response);
}

export async function getCustomerChangeOrder(jobId: string, orderId: string) {
  const response = await getData(
    userApi.changeOrder(jobId, orderId),
    undefined,
    { silent: true, force: true },
  );
  return unwrapOne(response);
}

export async function respondCustomerChangeOrder(
  jobId: string,
  orderId: string,
  body: { approved: boolean; customerNote?: string; signedBy?: string },
) {
  const response = await postData(
    userApi.changeOrderRespond(jobId, orderId),
    body,
    { silent: false },
  );
  return unwrapOne(response);
}
