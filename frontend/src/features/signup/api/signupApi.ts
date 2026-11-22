import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api/apiClient";

// Public sign-up contract (API-DESIGN §21, D-160). The answer is always 202, whatever the email.

export interface PublicSignupBody {
  fullName: string;
  email: string;
  phone: string;
  storeName: string | null;
  /** Hidden honeypot: people leave it empty. */
  website: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export const usePublicSignup = () =>
  useMutation({ mutationFn: (body: PublicSignupBody) => api.post<void>("/public/signup", body) });
