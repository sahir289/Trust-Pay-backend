// =============================================================================
// Trust Pay Backend - Jenkins ROLLBACK Pipeline
// -----------------------------------------------------------------------------
// One-click revert: check out a previous tag/commit on the chosen EC2 host and
// gracefully reload PM2 (zero-downtime). Use this during an incident instead of
// SSHing in by hand.
//
// Set up as a SEPARATE "Pipeline" job (not multibranch):
//   New Item -> Pipeline -> Pipeline script from SCM -> Script Path:
//   jenkins/Rollback.Jenkinsfile
//
// Access control mirrors the deploy pipeline: only ALLOWED_DEPLOYERS may run it,
// enforced here AND via Jenkins RBAC (see jenkins/SETUP.md).
//
// NOTE: This reverts CODE only. Database migrations in migrations/ are NOT
//       reversed automatically — undo any schema change manually.
// =============================================================================

pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
        ansiColor('xterm')
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['staging', 'production'],
            description: 'Which environment to roll back.'
        )
        string(
            name: 'TARGET_REF',
            defaultValue: '',
            description: 'Tag or commit SHA to roll back to (e.g. v2.0.106 for prod, or a commit SHA). Required.'
        )
        booleanParam(
            name: 'CONFIRM',
            defaultValue: false,
            description: 'Tick to confirm you really want to roll back the selected environment.'
        )
    }

    environment {
        // Keep in sync with the deploy Jenkinsfile.
        ALLOWED_DEPLOYERS = 'sahir289'
        STG_TARGET_DIR    = '/home/ubuntu/trust-pay/Trust-Pay-backend'
        PROD_TARGET_DIR   = '/home/ubuntu/Trust-Pay-backend'
    }

    stages {

        // ---------------------------------------------------------------------
        // 1. Authorize: only allowed users may roll back.
        // ---------------------------------------------------------------------
        stage('Authorize') {
            steps {
                script {
                    def allowed = env.ALLOWED_DEPLOYERS.split(',').collect { it.trim() }
                    def userCause = currentBuild.getBuildCauses('hudson.model.Cause$UserIdCause')
                    def triggeredBy = userCause ? userCause[0].userId : ''

                    echo "Rollback trigger identity resolved as: '${triggeredBy ?: 'unknown'}'"
                    if (!triggeredBy || !allowed.contains(triggeredBy)) {
                        error("Unauthorized: '${triggeredBy ?: 'unknown'}' is not permitted to roll back. " +
                              "Allowed: ${allowed.join(', ')}.")
                    }
                    echo "Authorized: ${triggeredBy}"
                }
            }
        }

        // ---------------------------------------------------------------------
        // 2. Validate inputs and resolve target host/credentials.
        // ---------------------------------------------------------------------
        stage('Validate & Resolve') {
            steps {
                script {
                    if (!params.CONFIRM) {
                        error("CONFIRM is not ticked — aborting rollback.")
                    }
                    if (!params.TARGET_REF?.trim()) {
                        error("TARGET_REF is required (a tag or commit SHA to roll back to).")
                    }

                    if (params.ENVIRONMENT == 'production') {
                        env.TARGET_DIR   = env.PROD_TARGET_DIR
                        env.SSH_CRED_ID  = 'ec2-prod-ssh-key'
                        env.HOST_CRED_ID = 'ec2-prod-host'
                    } else {
                        env.TARGET_DIR   = env.STG_TARGET_DIR
                        env.SSH_CRED_ID  = 'ec2-stg-ssh-key'
                        env.HOST_CRED_ID = 'ec2-stg-host'
                    }
                    echo "Rolling back ${params.ENVIRONMENT} (${env.TARGET_DIR}) to ref '${params.TARGET_REF}'"
                }
            }
        }

        // ---------------------------------------------------------------------
        // 3. Roll back on the host: checkout the ref + graceful PM2 reload.
        // ---------------------------------------------------------------------
        stage('Rollback') {
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: env.SSH_CRED_ID, keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: env.HOST_CRED_ID, variable: 'SSH_TARGET')
                ]) {
                    sh '''
                        set -e
                        echo "Testing SSH connection to ${ENVIRONMENT}..."
                        ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SSH_TARGET" "whoami"

                        echo "Rolling back ${ENVIRONMENT} at ${TARGET_DIR} to ${TARGET_REF}..."
                        ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SSH_TARGET" "\
                            cd '${TARGET_DIR}' && pwd && \
                            git fetch origin --tags --prune && \
                            git checkout --force '${TARGET_REF}' && \
                            git log -1 --oneline && \
                            npm install && \
                            pm2 startOrReload ecosystem.config.cjs --env production --update-env && \
                            pm2 save"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ ${params.ENVIRONMENT} rolled back to '${params.TARGET_REF}' (zero-downtime reload)."
            echo "ℹ️  The host is now in DETACHED HEAD at ${params.TARGET_REF}. To resume normal deploys, " +
                 "the next pipeline run will 'git checkout' the branch again, or fix forward and redeploy."
        }
        failure {
            echo "❌ Rollback FAILED for ${params.ENVIRONMENT}. Check the stage logs and the host state."
        }
        always {
            cleanWs()
        }
    }
}
