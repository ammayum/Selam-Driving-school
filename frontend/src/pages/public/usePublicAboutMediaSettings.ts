import { useEffect, useState } from "react";

import { api } from "../../api/client";
import { PublicAboutMediaSettings } from "../../types";

const fallbackSettings: PublicAboutMediaSettings = {
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  youtube_url: "",
  videos: [],
};

export function usePublicAboutMediaSettings() {
  const [settings, setSettings] = useState<PublicAboutMediaSettings>(fallbackSettings);

  useEffect(() => {
    api.getPublicAboutMediaSettings().then(setSettings).catch(() => setSettings(fallbackSettings));
  }, []);

  return settings;
}
