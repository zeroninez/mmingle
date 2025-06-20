"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { X, Upload, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
  onPostCreated?: () => void;
}

export function CreatePostModal({
  isOpen,
  onClose,
  location,
  onPostCreated,
}: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [locationName, setLocationName] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // 위치명 자동 가져오기 (Reverse Geocoding)
  const getLocationName = useCallback(async () => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&language=ko`,
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        setLocationName(address);
      }
    } catch (error) {
      console.error("위치명 가져오기 실패:", error);
    }
  }, [location]);

  // 모달이 열릴 때 위치명 가져오기
  useState(() => {
    if (isOpen) {
      getLocationName();
    }
    //@ts-ignore
  }, [isOpen, getLocationName]);

  // 이미지 드롭존
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newImages = acceptedFiles.slice(0, 5 - images.length); // 최대 5개
      setImages((prev) => [...prev, ...newImages]);

      // 미리보기 URL 생성
      const newPreviewUrls = newImages.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newPreviewUrls]);
    },
    [images.length],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
    },
    multiple: true,
    maxFiles: 5,
  });

  // 이미지 제거
  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // 이미지 업로드
  const uploadImages = async (postId: string) => {
    const uploadPromises = images.map(async (file, index) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${postId}/${Date.now()}_${index}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("post-images")
        .upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-images").getPublicUrl(fileName);

      // 이미지 정보를 DB에 저장
      await supabase.from("post_images").insert({
        post_id: postId,
        image_url: publicUrl,
        image_order: index,
      });

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  // 포스트 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setLoading(true);
    try {
      // 포스트 생성
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          latitude: location.lat,
          longitude: location.lng,
          location_name: locationName,
        })
        .select()
        .single();

      if (postError) throw postError;

      // 이미지 업로드
      if (images.length > 0) {
        await uploadImages(postData.id);
      }

      // 성공 처리
      onPostCreated?.();
      handleClose();
    } catch (error) {
      console.error("포스트 작성 실패:", error);
      alert("포스트 작성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setContent("");
    setLocationName("");
    setImages([]);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">새 포스트 작성</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* 사용자 정보 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0">
                {user?.avatar_url && (
                  <Image
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {user?.display_name || user?.username}
                </p>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span>{locationName || "위치 정보 가져오는 중..."}</span>
                </div>
              </div>
            </div>

            {/* 내용 입력 */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="무슨 일이 일어나고 있나요?"
              className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={500}
            />

            {/* 이미지 업로드 */}
            <div>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? "이미지를 여기에 드롭하세요"
                    : "이미지를 드래그하거나 클릭해서 업로드하세요"}
                </p>
                <p className="text-xs text-gray-400 mt-1">최대 5개까지 가능</p>
              </div>

              {/* 이미지 미리보기 */}
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <Image
                        src={url}
                        alt={`Preview ${index + 1}`}
                        width={100}
                        height={100}
                        className="rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 위치명 수정 */}
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="위치명을 입력하세요"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t flex justify-between items-center">
            <div className="text-sm text-gray-500">{content.length}/500</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!content.trim() || loading}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "게시 중..." : "게시하기"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
