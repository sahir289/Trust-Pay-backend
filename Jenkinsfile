
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
        ansiColor('xterm')
    }

    environment {
        // Only these Jenkins user IDs are permitted to run a deployment.
        ALLOWED_DEPLOYERS = 'sahir289'

        NODE_VERSION      = '23.x'
        STG_TARGET_DIR    = '/home/ubuntu/trust-pay/Trust-Pay-backend'
        PROD_TARGET_DIR   = '/home/ubuntu/Trust-Pay-backend'
    }

    stages {

        // ---------------------------------------------------------------------
        // 0. Skip CI: mark the build NOT_BUILT on the automated version-bump
        //    commit so the production "Version Bump" push does not loop.
        // ---------------------------------------------------------------------
        stage('Skip CI check') {
            steps {
                script {
                    def lastMsg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    env.SKIP_BUILD = lastMsg.contains('[skip ci]') ? 'true' : 'false'
                    if (env.SKIP_BUILD == 'true') {
                        echo "Last commit contains [skip ci] — skipping deployment. (${lastMsg})"
                        currentBuild.result = 'NOT_BUILT'
                    }
                }
            }
        }

        // ---------------------------------------------------------------------
        // 1. Authorize: hard-fail unless the trigger came from an allowed user.
        // ---------------------------------------------------------------------
        stage('Authorize') {
            when { environment name: 'SKIP_BUILD', value: 'false' }
            steps {
                script {
                    def allowed = env.ALLOWED_DEPLOYERS.split(',').collect { it.trim() }
                    def triggeredBy = ''

                    // User-triggered builds (manual "Build Now" / replay).
                    def userCause = currentBuild.getBuildCauses('hudson.model.Cause$UserIdCause')
                    if (userCause) {
                        triggeredBy = userCause[0].userId
                    }

                    // SCM/webhook-triggered builds: fall back to the commit author
                    // identity that Jenkins resolved from the change set.
                    if (!triggeredBy) {
                        triggeredBy = env.CHANGE_AUTHOR ?: env.GIT_COMMITTER_NAME ?: ''
                    }

                    echo "Deployment trigger identity resolved as: '${triggeredBy ?: 'unknown'}'"

                    if (!triggeredBy || !allowed.contains(triggeredBy)) {
                        error("Unauthorized: '${triggeredBy ?: 'unknown'}' is not permitted to deploy. " +
                              "Allowed deployers: ${allowed.join(', ')}.")
                    }
                    echo "Authorized deployer: ${triggeredBy}"
                }
            }
        }

        // ---------------------------------------------------------------------
        // 2. Resolve target environment from the branch being built.
        // ---------------------------------------------------------------------
        stage('Resolve Environment') {
            when { environment name: 'SKIP_BUILD', value: 'false' }
            steps {
                script {
                    switch (env.BRANCH_NAME) {
                        case 'main':
                            env.DEPLOY_ENV     = 'production'
                            env.PM2_ENV        = 'production'
                            env.TARGET_DIR     = env.PROD_TARGET_DIR
                            env.SSH_CRED_ID    = 'ec2-prod-ssh-key'   // sshUserPrivateKey credential
                            env.HOST_CRED_ID   = 'ec2-prod-host'      // secret text: user@host
                            env.DO_VERSION_BUMP = 'true'
                            break
                        case 'trust-pay-stg':
                            env.DEPLOY_ENV     = 'staging'
                            env.PM2_ENV        = 'staging'
                            env.TARGET_DIR     = env.STG_TARGET_DIR
                            env.SSH_CRED_ID    = 'ec2-stg-ssh-key'
                            env.HOST_CRED_ID   = 'ec2-stg-host'
                            env.DO_VERSION_BUMP = 'false'
                            break
                        default:
                            error("Branch '${env.BRANCH_NAME}' is not a deployable branch. " +
                                  "Only 'main' (prod) and 'trust-pay-stg' (staging) deploy.")
                    }
                    echo "Deploying branch '${env.BRANCH_NAME}' to ${env.DEPLOY_ENV} (${env.TARGET_DIR})"
                }
            }
        }

        // ---------------------------------------------------------------------
        // 3. Install dependencies.
        // ---------------------------------------------------------------------
        stage('Install Dependencies') {
            when { environment name: 'SKIP_BUILD', value: 'false' }
            steps {
                sh '''
                    set -e
                    echo "Node: $(node -v)  npm: $(npm -v)"
                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        echo "package-lock.json not found; falling back to npm install"
                        npm install
                    fi
                    echo "Backend version: $(node -p "require('./package.json').version")"
                '''
            }
        }

        // ---------------------------------------------------------------------
        // 4. Lint gate — fail the build on lint errors (mirrors Actions).
        // ---------------------------------------------------------------------
        stage('Lint') {
            when { environment name: 'SKIP_BUILD', value: 'false' }
            steps {
                sh 'npm run lint'
            }
        }

        // ---------------------------------------------------------------------
        // 5. Production-only: bump patch version and push tag back to origin.
        // ---------------------------------------------------------------------
        stage('Version Bump') {
            when {
                allOf {
                    environment name: 'SKIP_BUILD', value: 'false'
                    environment name: 'DO_VERSION_BUMP', value: 'true'
                }
            }
            steps {
                withCredentials([gitUsernamePassword(credentialsId: 'github-token', gitToolName: 'Default')]) {
                    sh '''
                        set -e
                        git config user.name  "Jenkins CI"
                        git config user.email "ci@trustpay.local"
                        npm version patch -m "CI: Bump version to %s [skip ci]"
                        git push origin HEAD:main --follow-tags
                    '''
                }
            }
        }

        // ---------------------------------------------------------------------
        // 6. Deploy to the resolved EC2 host over SSH.
        // ---------------------------------------------------------------------
        stage('Deploy') {
            when { environment name: 'SKIP_BUILD', value: 'false' }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: env.SSH_CRED_ID, keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: env.HOST_CRED_ID, variable: 'SSH_TARGET')
                ]) {
                    sh '''
                        set -e
                        echo "Testing SSH connection to ${DEPLOY_ENV}..."
                        ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SSH_TARGET" "whoami"

                        echo "Deploying to ${DEPLOY_ENV} at ${TARGET_DIR}..."
                        ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SSH_TARGET" "\
                            cd '${TARGET_DIR}' && pwd && \
                            git fetch origin && \
                            git checkout ${BRANCH_NAME} && \
                            git status && \
                            git pull origin ${BRANCH_NAME} --verbose && \
                            git log -1 --oneline && \
                            if [ -f package-lock.json ]; then npm ci; else echo 'package-lock.json not found; falling back to npm install'; npm install; fi && \
                            pm2 startOrReload ecosystem.config.cjs --env ${PM2_ENV} --update-env && \
                            pm2 save"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "${env.DEPLOY_ENV ?: 'Build'} deployment succeeded for branch '${env.BRANCH_NAME}'."
        }
        failure {
            echo "Deployment FAILED for branch '${env.BRANCH_NAME}'. Check the stage logs above."
        }
        always {
            cleanWs()
        }
    }
}
