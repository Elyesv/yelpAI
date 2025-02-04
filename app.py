"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""

import os
from pathlib import Path
from aws_cdk import (
    aws_lambda as lambda_,
    aws_efs as efs,
    aws_ec2 as ec2
)
from aws_cdk import App, Stack, Duration, RemovalPolicy, Tags

from constructs import Construct

class ServerlessHuggingFaceStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        # EFS doit être configuré dans un VPC
        vpc = ec2.Vpc(self, 'Vpc', max_azs=2)

        # Créer un système de fichiers EFS pour stocker les modèles en cache
        fs = efs.FileSystem(self, 'FileSystem',
                            vpc=vpc,
                            removal_policy=RemovalPolicy.DESTROY)
        access_point = fs.add_access_point('MLAccessPoint',
                                           create_acl=efs.Acl(
                                               owner_gid='1001', owner_uid='1001', permissions='750'),
                                           path="/export/models",
                                           posix_user=efs.PosixUser(gid="1001", uid="1001"))

        # Parcourir les fichiers Python dans le dossier Docker
        docker_folder = os.path.dirname(os.path.realpath(__file__)) + "/inference"
        pathlist = Path(docker_folder).rglob('*.py')

        for path in pathlist:
            base = os.path.basename(path)
            filename = os.path.splitext(base)[0]
            # Créer une fonction Lambda avec une image Docker
            lambda_.DockerImageFunction(
                self, filename,
                code=lambda_.DockerImageCode.from_image_asset(docker_folder,
                                                              cmd=[
                                                                  filename+".handler"]
                                                              ),
                memory_size=3008,
                timeout=Duration.seconds(600),
                vpc=vpc,
                filesystem=lambda_.FileSystem.from_efs_access_point(access_point, '/mnt/hf_models_cache'),
                environment={"TRANSFORMERS_CACHE": "/mnt/hf_models_cache"},
            )

app = App()

stack = ServerlessHuggingFaceStack(app, "ServerlessHuggingFaceStack")
Tags.of(stack).add("AwsSample", "ServerlessHuggingFace")

app.synth()
