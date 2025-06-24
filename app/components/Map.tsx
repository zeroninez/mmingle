// components/Map.tsx - 최적화된 지도 컴포넌트
"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { CreatePostModal } from "./CreatePostModal";
import { PostCard } from "./PostCard";
import { useAuth } from "@/contexts/AuthContext";
import { Post } from "@/lib/supabase";
import { loadPostsWithCounts } from "@/lib/postUtils"; // 최적화된 유틸리티 사용
import { MapPin, Plus } from "lucide-react";

interface MapProps {
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  showCreateButton?: boolean;
  height?: string;
  className?: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.978, // 서울 시청
};

export function Map({
  onLocationSelect,
  showCreateButton = true,
  height,
  className = "",
}: MapProps) {
  const { user } = useAuth();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newPostLocation, setNewPostLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 로딩 상태 관리를 위한 ref
  const loadingRef = useRef(false);
  const lastBoundsRef = useRef<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // 지역 내 포스트 로드 (최적화된 버전)
  const loadPostsInArea = useCallback(async () => {
    if (!map || loadingRef.current) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    // 같은 영역을 다시 로드하는 것을 방지
    const boundsString = bounds.toString();
    if (boundsString === lastBoundsRef.current) return;

    loadingRef.current = true;
    lastBoundsRef.current = boundsString;
    setLoading(true);

    try {
      console.log("🗺️ 지도 영역 포스트 로딩 시작");

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      // 최적화된 로딩 함수 사용
      const postsWithCounts = await loadPostsWithCounts(user, {
        bounds: { ne, sw },
        limit: 100, // 지도에서는 최대 100개만 표시
        order: { column: "created_at", ascending: false },
      });

      setPosts(postsWithCounts);
      console.log(`✅ 지도 포스트 로딩 완료: ${postsWithCounts.length}개`);
    } catch (error) {
      console.error("지도 포스트 로딩 실패:", error);
      setPosts([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [map, user]);

  // 지도 이동 시 포스트 다시 로드 (디바운스 적용)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const onMapIdle = useCallback(() => {
    // 이전 타이머 취소
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 500ms 후에 실행 (너무 빈번한 요청 방지)
    debounceTimeoutRef.current = setTimeout(() => {
      loadPostsInArea();
    }, 500);
  }, [loadPostsInArea]);

  // 지도 클릭 시 새 포스트 위치 설정
  const onMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!user || !showCreateButton) return;

      const lat = event.latLng?.lat();
      const lng = event.latLng?.lng();

      if (lat && lng) {
        setNewPostLocation({ lat, lng });
        setIsCreateModalOpen(true);
        onLocationSelect?.({ lat, lng });
      }
    },
    [user, showCreateButton, onLocationSelect],
  );

  // 지도 로드 완료 시
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  // 지도 언마운트 시
  const onUnmount = useCallback(() => {
    setMap(null);
    // 타이머 정리
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // 초기 포스트 로드
  useEffect(() => {
    if (map && !loadingRef.current) {
      loadPostsInArea();
    }
  }, [map, loadPostsInArea]);

  // 포스트 생성 후 새로고침
  const handlePostCreated = useCallback(() => {
    setIsCreateModalOpen(false);
    setNewPostLocation(null);
    // 현재 영역 다시 로드
    lastBoundsRef.current = null; // 강제로 다시 로드하도록
    loadPostsInArea();
  }, [loadPostsInArea]);

  // 포스트 업데이트 후 새로고침
  const handlePostUpdate = useCallback(() => {
    lastBoundsRef.current = null;
    loadPostsInArea();
  }, [loadPostsInArea]);

  if (!isLoaded) {
    return (
      <div
        style={height ? { height } : undefined}
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className} ${!height ? "h-full" : ""}`}
      >
        <div className="text-gray-500">지도 로딩 중...</div>
      </div>
    );
  }

  return (
    <div
      style={height ? { height } : undefined}
      className={`relative rounded-lg overflow-hidden ${className} ${!height ? "h-full" : ""}`}
    >
      <GoogleMap
        mapTypeId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "roadmap"}
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={onMapIdle}
        onClick={onMapClick}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* 포스트 마커들 */}
        {posts.map((post) => (
          <Marker
            key={post.id}
            position={{ lat: post.latitude, lng: post.longitude }}
            onClick={() => setSelectedPost(post)}
            icon={{
              url:
                "data:image/svg+xml," +
                encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="white" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
            }}
          />
        ))}

        {/* 새 포스트 위치 마커 */}
        {newPostLocation && (
          <Marker
            position={newPostLocation}
            icon={{
              url:
                "data:image/svg+xml," +
                encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#EF4444" stroke="white" stroke-width="2"/>
                  <path d="M12 8v8M8 12h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(32, 32),
            }}
          />
        )}
      </GoogleMap>

      {/* 로딩 인디케이터 */}
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-md">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-700">포스트 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 포스트 수 표시 */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-md">
        <div className="flex items-center space-x-1">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {posts.length}개
          </span>
        </div>
      </div>

      {/* 선택된 포스트 표시 */}
      {selectedPost && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <PostCard
              post={selectedPost}
              onUpdate={handlePostUpdate}
              compact={true}
            />
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute top-2 right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
            >
              <span className="text-gray-600 text-xs">×</span>
            </button>
          </div>
        </div>
      )}

      {/* 새 포스트 생성 모달 */}
      {isCreateModalOpen && newPostLocation && (
        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setNewPostLocation(null);
          }}
          location={newPostLocation}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
}
