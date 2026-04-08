#!/bin/bash
# 生成 Android 签名密钥脚本
# 运行: ./generate-keystore.sh

KEYSTORE_FILE="audioflow.keystore"
KEY_ALIAS="audioflow"
VALIDITY_DAYS=10000

# 提示输入信息
echo "=== 生成 Android 签名密钥 ==="
echo "请按提示输入信息（用于 APK 签名）"
echo ""

# 生成密钥
keytool -genkey -v \
  -keystore $KEYSTORE_FILE \
  -alias $KEY_ALIAS \
  -keyalg RSA \
  -keysize 2048 \
  -validity $VALIDITY_DAYS

echo ""
echo "=== 密钥生成完成 ==="
echo "密钥文件: $KEYSTORE_FILE"
echo ""
echo "=== 转换为 Base64（用于 GitHub Secrets）==="
base64 $KEYSTORE_FILE | tee keystore.base64.txt
echo ""
echo "=== 请复制上面 keystore.base64.txt 的内容到 GitHub Secrets ==="
echo "密钥别名: $KEY_ALIAS"
