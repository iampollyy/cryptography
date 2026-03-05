# Cryptography Implementation Guide

This document outlines the implementation of both symmetric and asymmetric cryptography techniques.

---

## Symmetric Cryptography

### 1. Correct Symmetric Key

**Key Value:**

```
54684020247570407220244063724074
```

#### Validation Method

To determine the correct key, I calculated the SHA256 hash for each provided key and compared it with the reference value. A matching hash confirms the key's accuracy.

**Python Implementation:**
![alt text](image.png)

---

### 2. Decrypted Message

**Result:**

```
Hello Blockchain!
```

#### Decryption Algorithm

The message was decrypted using AES encryption in CBC mode. The standard Python approach would involve:

1. Convert key to bytes
2. Convert ciphertext to bytes
3. Convert IV (Initialization Vector) to bytes
4. Create AES cipher in CBC mode
5. Decrypt the ciphertext
6. Remove padding

![alt text](image-1.png)
![alt text](image-2.png)

**Note:** For this exercise, the decryption was performed using the online tool: [AES Online Tools](http://aes.online-domain-tools.com/)

---

## Asymmetric Cryptography

### 1. EC Key-Pair

An Elliptic Curve key-pair was generated using [EC Functions Tool](https://8gwifi.org/ecfunctions.jsp)

#### Public Key

```
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9zRFQYPj63IaH81VHLaaOwh4ei2A
Yw+AH+CkcWlvAscMFg7oJM0s9kAQ4/pBR0Q2BZYQIReWZRx/YnCKwQOifw==
-----END PUBLIC KEY-----
```

#### Original Message

```
Hello Blockchain!
```

---

### 2. Digital Signature

A digital signature was created using the private key from the EC key-pair generated in the previous step.

#### Digital Signature (Base64 Encoded)

```
MEUCIGgJjjXfwUL7T+NQAeEd+YKI6OEqnu3Qj5AUj+HD/dEDAiEAjx+ImXUVjI4Beq2zaN/Qg7vAzOG87yTgzpdasZDEUMU=
```

## ![alt text](image-3.png)

**Tools Used:**

- Python with PyCryptodome library
- [AES Online Tools](http://aes.online-domain-tools.com/)
- [EC Functions Tool](https://8gwifi.org/ecfunctions.jsp)
