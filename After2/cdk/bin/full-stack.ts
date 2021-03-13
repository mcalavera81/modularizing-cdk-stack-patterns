#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ApiGatewayStack } from '../lib/stacks/apigateway/apigateway';
import { CdnStack } from '../lib/stacks/cdn/cdn';
import { CodeStack } from '../lib/stacks/code/code';
import { CognitoStack } from '../lib/stacks/cognito/cognito';
import { DatabaseStack } from '../lib/stacks/database/database';
import { LambdaStack } from '../lib/stacks/lambda/lambda';
import { S3Stack } from '../lib/stacks/s3/s3';
import { DeploymentStack } from '../lib/stacks/deployment/deployment';
import ssm = require('@aws-cdk/aws-ssm');
import { SsmSeederStack } from '../lib/stacks/ssmseeder/ssmseeder';

const app = new cdk.App();

let projectName: string = app.node.tryGetContext('projectname') || 'MyCdkGoals';
const envList: string[] = ['Dev-local', 'Dev-integration'];

if (projectName.length > 12)
    throw new Error('Project name must be 12 characters or less');

/* SSM Parameter Seeder Stack */
new SsmSeederStack(app, 'SsmSeederAppStack');

/* Deployment 'Container' Stack */
const DeploymentAppStack = new DeploymentStack(app, 'DeploymentAppStack', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } });

/* Get the appropriate env either from context for from SSM */
let bizEnv = app.node.tryGetContext('env') || ssm.StringParameter.valueFromLookup(DeploymentAppStack, '/CdkEnvs/Default-env');
if (!envList.includes(bizEnv))
    throw new Error(`Allowable values for env are ${envList}`);

/* Property Objects */
//#region 

/* Environment Properties */
//  Environment List: 'Dev-local', 'Dev-integration'
const envProps = {
    useCdn: true
};

/* Project Properties */
const projProps = {
    projectName: projectName
};

/* Api Gateway Properties */
const apiProps = {
    apiName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/apiName`)),
    authorizorName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/authorizorName`))
};

/* Cdn Properties */
const cdnProps = {
    cdnComment: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/cdnComment`)),
    cdnWebsiteIndexDocument: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/cdnWebsiteIndexDocument`)
};

/* CodeBuild/Pipeline Properties */
const codeProps = {
    codeBuildRoleName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/codeBuildRoleName`)),
    codePipelineRoleName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/codePipelineRoleName`)),
    pipelineProjectName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/pipelineProjectName`)),
    pipelineProjectDescription: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/pipelineProjectDescription`)),
    pipelineProjectBuildSpec: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/pipelineProjectBuildSpec`)
};

/* Cognito Properties */
const cognitoProps = {
    userPoolName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/userPoolName`)),
    userPoolClientName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/userPoolClientName`)),
    identityPoolName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/identityPoolName`))
};

/* DynamoDb Properties */
const dbProps = {
    tableName: `${projectName}-`.concat(ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/tableName`)),
    partitionKeyName: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/partitionKeyName`),
    sortKeyName: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/sortKeyName`)
};

/* Lambda Properties */
const lambdaProps = {
    
};

/* S3 Properties */
const s3Props = {

    s3WebsiteDeploySource: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/s3WebsiteDeploySource`),
    websiteIndexDocument: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/websiteIndexDocument`),
    websiteErrorDocument: ssm.StringParameter.valueFromLookup(DeploymentAppStack, `/CdkEnvs/${bizEnv}/websiteErrorDocument`)
}

/* Full Application Properties */
const props = {
    ...envProps, ...projProps, ...apiProps, ...cdnProps, ...codeProps, ...cognitoProps, ...dbProps, ...lambdaProps, ...s3Props
};

/* Uncomment if you are having issues with property params */
console.log(props);

//#endregion

const DatabaseAppStack = new DatabaseStack(app, 'DatabaseAppStack', props);
const S3AppStack = new S3Stack(app, 'S3AppStack', props);

if (props.useCdn) {
    const CdnAppStack = new CdnStack(app, 'CdnAppStack', S3AppStack.websiteBucket, props);
}

const LambdaAppStack = new LambdaStack(app, 'LambdaAppStack', DatabaseAppStack.goalsTable, DatabaseAppStack.dynamoDbRole, props);
const CognitoAppStack = new CognitoStack(app, 'CognitoAppStack', props);
const ApiGatewayAppStack = new ApiGatewayStack(app, 'ApiGatewayAppStack', LambdaAppStack, CognitoAppStack, props);
const CodeAppStack = new CodeStack(app, 'CodeAppStack', CognitoAppStack, S3AppStack, ApiGatewayAppStack, props);
