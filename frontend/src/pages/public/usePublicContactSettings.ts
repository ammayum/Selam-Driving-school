import { useEffect, useState } from "react";

import { api } from "../../api/client";
import { PublicContactSettings } from "../../types";

const fallbackContact: PublicContactSettings = {
  phone: "",
  phone_link: "",
  email: "",
  address: "",
  whatsapp: "",
  whatsapp_link: "",
  contact_note: "",
};

export function usePublicContactSettings() {
  const [contact, setContact] = useState<PublicContactSettings>(fallbackContact);

  useEffect(() => {
    api.getPublicContactSettings().then(setContact).catch(() => setContact(fallbackContact));
  }, []);

  return contact;
}
