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

interface MapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  showCreateButton?: boolean;
}

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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">지도 로딩 중...</div>
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
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* 사용자 현재 위치 마커 */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url:
                "data:image/svg+xml;charset=UTF-8," +
                encodeURIComponent(`
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="8" fill="#4285F4" stroke="#fff" stroke-width="2"/>
                  <circle cx="10" cy="10" r="3" fill="#fff"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}

        {/* 포스트 마커들 */}
        {posts.map((post) => (
          <Marker
            key={post.id}
            position={{ lat: post.latitude, lng: post.longitude }}
            onClick={() => setSelectedPost(post)}
            icon={{
              url:
                "data:image/svg+xml;charset=UTF-8," +
                encodeURIComponent(`
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="15" cy="15" r="12" fill="#84cc16" stroke="#fff" stroke-width="2"/>
                  <text x="15" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">📍</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(30, 30),
            }}
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
          >
            <div className="max-w-sm">
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
    </div>
  );
}
