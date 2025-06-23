"use client";

import { useState, useCallback, useEffect } from "react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useDropzone } from "react-dropzone";
import { X, Upload, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { HashtagInput, savePostHashtags } from "./HashtagSystem";

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
      setLocationName(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    }
  }, [location]);

  // 모달이 열릴 때 위치명 가져오기
  useEffect(() => {
    if (isOpen) {
      getLocationName();
    }
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

      try {
        // 1. Storage에 파일 업로드
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage 업로드 실패:", uploadError);
          throw uploadError;
        }

        console.log("Storage 업로드 성공:", uploadData);

        // 2. 공개 URL 가져오기
        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;
        console.log("Public URL 생성:", publicUrl);

        // 3. 이미지 정보를 DB에 저장
        const { error: insertError } = await supabase
          .from("post_images")
          .insert({
            post_id: postId,
            image_url: publicUrl,
            image_order: index,
          });

        if (insertError) {
          console.error("이미지 DB 저장 실패:", insertError);
          throw insertError;
        }

        console.log("이미지 DB 저장 완료:", index);
        return publicUrl;
      } catch (error) {
        console.error(`이미지 ${index} 업로드 중 에러:`, error);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  };

  // 포스트 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      console.log("포스트 작성 시작:", {
        user_id: user.id,
        content: content.trim(),
        location,
        locationName,
      });

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

      if (postError) {
        console.error("포스트 생성 실패:", postError);
        throw postError;
      }

      console.log("포스트 생성 성공:", postData);

      // 해시태그 저장
      try {
        await savePostHashtags(postData.id, content);
        console.log("해시태그 저장 완료");
      } catch (hashtagError) {
        console.error("해시태그 저장 실패:", hashtagError);
        // 해시태그 저장 실패해도 포스트는 유지
      }

      // 이미지 업로드 (실패해도 포스트는 유지)
      if (images.length > 0) {
        console.log("이미지 업로드 시작:", images.length, "개");
        try {
          await uploadImages(postData.id);
          console.log("이미지 업로드 완료");
        } catch (imageError) {
          console.error("이미지 업로드 실패:", imageError);
          // 이미지 업로드가 실패해도 포스트는 생성되었으므로 계속 진행
        }
      }

      // 성공 처리
      console.log("포스트 작성 완료");
      onPostCreated?.();
      handleClose();
      alert("포스트가 성공적으로 작성되었습니다!");
    } catch (error: any) {
      console.error("포스트 작성 실패:", error);

      // 더 구체적인 에러 메시지
      let errorMessage = "포스트 작성에 실패했습니다.";

      if (error?.code === "23505") {
        errorMessage = "중복된 데이터가 있습니다.";
      } else if (error?.code === "42501") {
        errorMessage = "권한이 없습니다. 로그인 상태를 확인해주세요.";
      } else if (error?.message) {
        errorMessage = `오류: ${error.message}`;
      }

      alert(errorMessage);
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
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-lime-400 to-lime-600">
          <h2 className="text-lg font-semibold text-white">새 포스트 작성</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full text-white"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* 사용자 정보 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 overflow-hidden">
                {user?.avatar_url ? (
                  <OptimizedImage
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    priority={true}
                  />
                ) : (
                  <div className="w-full h-full bg-lime-100 flex items-center justify-center text-lime-600 font-semibold">
                    {(user?.display_name || user?.username)
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>
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

            {/* 해시태그 지원 내용 입력 */}
            <div>
              <HashtagInput
                value={content}
                onChange={setContent}
                placeholder="이 곳에서 무슨 일이 일어나고 있나요? #해시태그를 사용해보세요!"
                className="min-h-[120px]"
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                {content.length}/500
              </div>
            </div>

            {/* 이미지 업로드 */}
            <div>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-lime-400 bg-lime-50"
                    : "border-gray-300 hover:border-lime-400 hover:bg-lime-50"
                } ${loading ? "pointer-events-none opacity-50" : ""}`}
              >
                <input {...getInputProps()} disabled={loading} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? "이미지를 여기에 놓으세요"
                    : "이미지를 드래그하거나 클릭해서 업로드 (최대 5개)"}
                </p>
              </div>

              {/* 이미지 미리보기 */}
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <OptimizedImage
                        src={url}
                        alt={`미리보기 ${index + 1}`}
                        width={150}
                        height={150}
                        className="w-full h-24 object-cover rounded"
                        priority={false}
                      />
                      {!loading && (
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="flex-1 px-4 py-2 bg-lime-500 text-white rounded-lg font-medium hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    작성 중...
                  </>
                ) : (
                  "포스트 작성"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
