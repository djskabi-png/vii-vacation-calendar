#!/usr/bin/env node
"use strict";

process.env.QA_LOCALE_ONLY = "1";
require("./audit-comprehensive-production.cjs");
