import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DevicePage } from "@/components/device/device-page";

const deviceSearch = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/device")({
  validateSearch: (input) => deviceSearch.parse(input),
  component: DevicePage,
});
