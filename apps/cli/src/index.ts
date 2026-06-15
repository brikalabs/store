#!/usr/bin/env bun
import { createRegistryCli } from "./lib";

// The framework's runner parses argv, resolves the command, and maps any
// CliError to a clean message + non-zero exit.
await createRegistryCli().run();
