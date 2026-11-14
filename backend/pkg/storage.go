package pkg

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Storage handles file uploads to S3-compatible storage, with local disk fallback.
type Storage struct {
	client   *s3.Client
	bucket   string
	baseURL  string
	useLocal bool
}

func NewStorage() *Storage {
	bucket := os.Getenv("S3_BUCKET")
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	region := os.Getenv("S3_REGION")
	baseURL := os.Getenv("S3_BASE_URL")

	if bucket == "" || accessKey == "" {
		return &Storage{useLocal: true}
	}
	if region == "" {
		region = "auto"
	}

	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return &Storage{useLocal: true}
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true
		}
	})
	return &Storage{client: client, bucket: bucket, baseURL: baseURL}
}

// Upload saves the file to S3 (or local disk) under the given folder and returns the public URL.
func (s *Storage) Upload(ctx context.Context, file *multipart.FileHeader, folder string) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(src); err != nil {
		return "", err
	}

	ext := filepath.Ext(file.Filename)
	key := fmt.Sprintf("%s/%d_%s%s", folder, time.Now().UnixMilli(), randomHex(8), ext)

	if s.useLocal {
		dir := filepath.Join("uploads", folder)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", err
		}
		localPath := filepath.Join("uploads", key)
		if err := os.WriteFile(localPath, buf.Bytes(), 0644); err != nil {
			return "", err
		}
		return "/uploads/" + key, nil
	}

	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String(mimeByExt(ext)),
	})
	if err != nil {
		return "", fmt.Errorf("s3 upload: %w", err)
	}

	if s.baseURL != "" {
		return s.baseURL + "/" + key, nil
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.bucket, key), nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func mimeByExt(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}
