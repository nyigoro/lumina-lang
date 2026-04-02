// Keep formatter color assertions deterministic under Jest's non-TTY runtime.
process.env.FORCE_COLOR ??= '1';
