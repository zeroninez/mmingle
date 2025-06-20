"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "./PostCard";
import { CreatePostModal } from "./CreatePostModal";

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

const defaultCenter = {
  lat: 37.5665, // 서울 시청
  lng: 126.978,
};

// 커스텀 지도 스타일
const customMapStyle = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#a2daf2" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f8f9fa" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e9ecef" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6c757d" }],
  },
];

interface MapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  showCreateButton?: boolean;
}

// 커스텀 마커 컴포넌트 (SVG)
const createCustomMarkerIcon = (type: "post" | "user") => {
  if (type === "user") {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
          <circle cx="12" cy="12" r="4" fill="#ffffff"/>
          <circle cx="12" cy="12" r="12" fill="#4285F4" opacity="0.3">
            <animate attributeName="r" values="4;16;4" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
          </circle>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12),
    };
  }

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#84cc16;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#65a30d;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <dropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.059 27.941 0 18 0z" 
              fill="url(#gradient)" 
              stroke="#ffffff" 
              stroke-width="2"
              filter="url(#shadow)"/>
        <circle cx="18" cy="18" r="8" fill="#ffffff"/>
        <text x="18" y="23" text-anchor="middle" fill="#65a30d" font-size="12" font-weight="bold">📍</text>
      </svg>
    `)}`,
    scaledSize: new google.maps.Size(36, 48),
    anchor: new google.maps.Point(18, 48),
  };
};

export function Map({ onLocationSelect, showCreateButton = true }: MapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["places"],
  });

  const { user } = useAuth();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPostLocation, setNewPostLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  // 사용자 현재 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn("위치 정보를 가져올 수 없습니다:", error);
        },
      );
    }
  }, []);

  // 지도 영역의 포스트 로드
  const loadPostsInArea = useCallback(async () => {
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const { data: postsData, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        user:users(id, username, display_name, avatar_url),
        images:post_images(id, image_url, image_order),
        likes_count:likes(count),
        comments_count:comments(count)
      `,
      )
      .gte("latitude", sw.lat())
      .lte("latitude", ne.lat())
      .gte("longitude", sw.lng())
      .lte("longitude", ne.lng())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("포스트 로드 실패:", error);
      return;
    }

    // 좋아요 상태 확인 (로그인된 사용자만)
    let postsWithLikes = postsData || [];
    if (user && postsData) {
      const postIds = postsData.map((post) => post.id);
      const { data: userLikes } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);

      const likedPostIds = new Set(userLikes?.map((like) => like.post_id));

      postsWithLikes = postsData.map((post) => ({
        ...post,
        is_liked: likedPostIds.has(post.id),
      }));
    }

    setPosts(postsWithLikes);
  }, [map, user]);

  // 지도 이동 시 포스트 다시 로드
  const onMapIdle = useCallback(() => {
    loadPostsInArea();
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
        onLocationSelect?.(lat, lng);
      }
    },
    [user, showCreateButton, onLocationSelect],
  );

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // 내 위치로 이동
  const goToMyLocation = () => {
    if (userLocation && map) {
      map.panTo(userLocation);
      map.setZoom(17);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        if (map) {
          map.panTo(location);
          map.setZoom(17);
        }
      });
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-lime-50 to-green-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime-200 border-t-lime-500 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-700 font-medium">
            지도 로딩 중...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={userLocation || defaultCenter}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={onMapIdle}
        onClick={onMapClick}
        options={{
          styles: customMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
            //@ts-ignore
            style: google.maps.ZoomControlStyle.SMALL,
          },
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          minZoom: 10,
          maxZoom: 20,
        }}
      >
        {/* 사용자 현재 위치 마커 */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={createCustomMarkerIcon("user")}
            title="내 위치"
            zIndex={1000}
          />
        )}

        {/* 포스트 마커들 */}
        {posts.map((post) => (
          <Marker
            key={post.id}
            position={{ lat: post.latitude, lng: post.longitude }}
            onClick={() => setSelectedPost(post)}
            onMouseOver={() => setHoveredMarker(post.id)}
            onMouseOut={() => setHoveredMarker(null)}
            icon={{
              ...createCustomMarkerIcon("post"),
              scaledSize:
                hoveredMarker === post.id
                  ? new google.maps.Size(42, 56)
                  : new google.maps.Size(36, 48),
            }}
            title={
              post.content?.slice(0, 50) +
              (post.content?.length > 50 ? "..." : "")
            }
            animation={
              hoveredMarker === post.id
                ? google.maps.Animation.BOUNCE
                : undefined
            }
            zIndex={hoveredMarker === post.id ? 999 : 1}
          />
        ))}

        {/* 선택된 포스트 정보창 */}
        {selectedPost && (
          <InfoWindow
            position={{
              lat: selectedPost.latitude,
              lng: selectedPost.longitude,
            }}
            onCloseClick={() => setSelectedPost(null)}
            options={{
              pixelOffset: new google.maps.Size(0, -48),
              maxWidth: 350,
              disableAutoPan: false,
            }}
          >
            <div className="max-w-sm">
              <div className="bg-gradient-to-r from-lime-400 to-lime-600 text-white px-3 py-2 -mx-3 -mt-3 mb-3 rounded-t-lg">
                <div className="font-semibold flex items-center gap-2">
                  📍 {selectedPost.location_name || "포스트 위치"}
                </div>
              </div>
              <PostCard
                post={selectedPost}
                onUpdate={loadPostsInArea}
                compact
              />
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* 새 포스트 작성 모달 */}
      {isCreateModalOpen && newPostLocation && (
        <CreatePostModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setNewPostLocation(null);
          }}
          location={newPostLocation}
          onPostCreated={loadPostsInArea}
        />
      )}

      {/* 플로팅 컨트롤 */}
      {showCreateButton && (
        <div className="absolute bottom-6 right-6 flex flex-col gap-3">
          {/* 내 위치로 이동 버튼 */}
          <button
            onClick={goToMyLocation}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-lime-600 hover:bg-lime-50 hover:shadow-xl transition-all duration-200 border border-gray-100"
            title="내 위치로 이동"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
          </button>

          {/* 도움말 */}
          <div className="bg-white rounded-lg shadow-lg p-4 text-sm text-gray-600 max-w-56 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              ✨ <span className="font-medium text-gray-800">사용법</span>
            </div>
            <div>지도를 클릭해서 그 위치에 포스트를 작성해보세요!</div>
          </div>
        </div>
      )}

      {/* 지도 로딩 오버레이 */}
      {!map && (
        <div className="absolute inset-0 bg-gradient-to-br from-lime-50 to-green-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-lime-200 border-t-lime-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg text-gray-700 font-medium">
              지도 준비 중...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
