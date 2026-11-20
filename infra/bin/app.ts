#!/usr/bin/env node
import * as path from 'node:path';
import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { contextBool, contextString, contextStringList, contextStringMap } from '../lib/context';
import { StaticMfeSiteStack } from '../lib/static-mfe-site-stack';

// ---------------------------------------------------------------------------
// Per-repo defaults. This block is the ONLY difference between the infra/
// packages of react17-portal and react19-app.
// ---------------------------------------------------------------------------
const DEFAULTS = {
  stackName: 'Portal17WebStack',
  appName: 'portal17',
  repoName: 'react17-portal',
};
// ---------------------------------------------------------------------------

const app = new App();
const ctx = (key: string): unknown => app.node.tryGetContext(key);

const infraRoot = path.resolve(__dirname, '..');
const distPath = path.resolve(infraRoot, contextString(ctx('distPath')) ?? '../dist');

new StaticMfeSiteStack(app, DEFAULTS.stackName, {
  stackName: DEFAULTS.stackName,
  appName: DEFAULTS.appName,
  repoName: DEFAULTS.repoName,
  envName: contextString(ctx('envName')) ?? 'dev',
  distPath,
  allowedOrigins: contextStringList(ctx('allowedOrigins'), 'allowedOrigins') ?? [
    'http://localhost:5170',
    'http://localhost:5190',
  ],
  remotes: contextStringMap(ctx('remotes'), 'remotes'),
  destroyOnRemoval: contextBool(ctx('destroyOnRemoval'), false),
  domainName: contextString(ctx('domainName')),
  hostedZoneName: contextString(ctx('hostedZoneName')),
  hostedZoneId: contextString(ctx('hostedZoneId')),
  certificateArn: contextString(ctx('certificateArn')),
  // Always environment-agnostic: nothing here needs lookups, so `cdk synth`
  // works without AWS credentials and the template is identical everywhere.
  // The target account/region come from the deploy credentials.
});

if (contextBool(ctx('nag'), true)) {
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
}
