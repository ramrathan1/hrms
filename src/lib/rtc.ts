/* WebRTC mesh call manager. Signaling rides over the app WebSocket.
   Newcomers initiate offers to every existing peer in the room. */
import { wsc } from "./ws";

export type Peer = { peerId: string; name: string; stream?: MediaStream };

export class MeshCall {
  private pcs = new Map<string, RTCPeerConnection>();
  private streams = new Map<string, MediaStream>();
  private names = new Map<string, string>();
  private offs: (() => void)[] = [];

  constructor(
    private roomId: string,
    private local: MediaStream | null,
    private onPeers: (peers: Peer[]) => void
  ) {}

  join() {
    this.offs.push(
      wsc.on("meet:peers", ({ peers }) => {
        for (const p of peers) {
          this.names.set(p.peerId, p.name);
          void this.call(p.peerId);
        }
        this.emit();
      }),
      wsc.on("meet:peer-joined", ({ peer }) => {
        this.names.set(peer.peerId, peer.name); // they will send us an offer
        this.emit();
      }),
      wsc.on("meet:peer-left", ({ peerId }) => {
        this.pcs.get(peerId)?.close();
        this.pcs.delete(peerId);
        this.streams.delete(peerId);
        this.names.delete(peerId);
        this.emit();
      }),
      wsc.on("rtc:signal", ({ from, data }) => void this.onSignal(from, data))
    );
    wsc.send({ type: "meet:join", roomId: this.roomId });
  }

  private pc(peerId: string): RTCPeerConnection {
    let pc = this.pcs.get(peerId);
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    this.pcs.set(peerId, pc);
    this.local?.getTracks().forEach((t) => pc!.addTrack(t, this.local!));
    pc.onicecandidate = (e) => {
      if (e.candidate) wsc.send({ type: "rtc:signal", to: peerId, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      this.streams.set(peerId, e.streams[0]);
      this.emit();
    };
    return pc;
  }

  private async call(peerId: string) {
    const pc = this.pc(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsc.send({ type: "rtc:signal", to: peerId, data: { sdp: pc.localDescription } });
  }

  private async onSignal(from: string, data: any) {
    const pc = this.pc(from);
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsc.send({ type: "rtc:signal", to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch (err) {
      console.warn("[rtc] signal error", err);
    }
  }

  /** Swap the outgoing video track (camera <-> screen share) on every connection. */
  replaceVideoTrack(track: MediaStreamTrack | null) {
    for (const pc of this.pcs.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && track) void sender.replaceTrack(track);
    }
  }

  private emit() {
    const peers: Peer[] = [...this.names.entries()].map(([peerId, name]) => ({
      peerId,
      name,
      stream: this.streams.get(peerId),
    }));
    this.onPeers(peers);
  }

  leave() {
    wsc.send({ type: "meet:leave" });
    for (const pc of this.pcs.values()) pc.close();
    this.pcs.clear();
    this.streams.clear();
    this.names.clear();
    this.offs.forEach((off) => off());
    this.offs = [];
  }
}
