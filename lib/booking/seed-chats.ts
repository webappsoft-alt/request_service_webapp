import type { ChatThread } from "@/lib/booking/chat-store";
import { getPortalRequests } from "@/lib/data/portal";
import type { Provider } from "@/lib/types";

function at(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

export function getSeedChatThreads(provider: Provider): ChatThread[] {
  const leads = getPortalRequests(provider);
  const first = leads[0];
  const second = leads[1];
  const third = leads[2];
  if (!first || !second || !third) return [];

  return [
    {
      id: "chat_seed_elena",
      providerId: provider.id,
      customerName: first.customerName,
      customerEmail: first.customerEmail,
      requestId: first.id,
      unreadForProvider: 2,
      unreadForCustomer: 0,
      updatedAt: at(0.4),
      messages: [
        {
          id: "msg_seed_e1",
          from: "customer",
          text: `Hi — I sent a quote request for ${first.serviceName}. Water is pooling under the kitchen sink.`,
          at: at(5),
          attachments: [],
        },
        {
          id: "msg_seed_e2",
          from: "customer",
          text: "Here’s a photo of the cabinet. Can you send a written estimate this week?",
          at: at(4.6),
          attachments: [
            {
              id: "att_seed_e1",
              name: "kitchen-cabinet.jpg",
              url: "/images/services/service-plumbing.jpg",
              type: "image/jpeg",
            },
          ],
        },
        {
          id: "msg_seed_e3",
          from: "provider",
          text: "Got the photo. We can come Thursday morning, then I’ll send the estimate from this lead.",
          at: at(3),
          attachments: [],
        },
        {
          id: "msg_seed_e4",
          from: "customer",
          text: "Thursday works. I’ll leave the side gate open.",
          at: at(0.4),
          attachments: [],
        },
      ],
    },
    {
      id: "chat_seed_john",
      providerId: provider.id,
      customerName: second.customerName,
      customerEmail: second.customerEmail,
      requestId: second.id,
      unreadForProvider: 0,
      unreadForCustomer: 0,
      updatedAt: at(8),
      messages: [
        {
          id: "msg_seed_j1",
          from: "customer",
          text: `We need ${second.serviceName} at the office park. Scope notes are attached.`,
          at: at(26),
          attachments: [
            {
              id: "att_seed_j1",
              name: "scope-notes.pdf",
              url: "/images/services/service-plumbing.jpg",
              type: "application/pdf",
            },
          ],
        },
        {
          id: "msg_seed_j2",
          from: "provider",
          text: "Reviewed the notes. I’ll write the estimate on this lead and send it over today.",
          at: at(8),
          attachments: [],
        },
      ],
    },
    {
      id: "chat_seed_aisha",
      providerId: provider.id,
      customerName: third.customerName,
      customerEmail: third.customerEmail,
      requestId: third.id,
      unreadForProvider: 1,
      unreadForCustomer: 0,
      updatedAt: at(1.2),
      messages: [
        {
          id: "msg_seed_a1",
          from: "customer",
          text: "Can you also look at the second-floor bath while you’re here?",
          at: at(1.2),
          attachments: [],
        },
      ],
    },
  ];
}
