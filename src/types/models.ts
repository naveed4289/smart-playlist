export type PlaylistRow = {
  id: string;
  user_id: string;
  name: string;
  updated_at: string;
};

export type PlaylistTrackRow = {
  id: string;
  playlist_id: string;
  position: number;
  spotify_track_id: string;
  title: string;
  artists: string[];
  album: string | null;
  image_url: string | null;
  duration_ms: number | null;
  release_date: string | null;
  preview_url: string | null;
  genius_song_id: string | null;
  genius_description: string | null;
  genius_url: string | null;
  genius_annotations: GeniusAnnotation[] | null;
  created_at: string;
};

export type GeniusAnnotation = {
  fragment: string;
  annotation: string;
  votes: number;
};
