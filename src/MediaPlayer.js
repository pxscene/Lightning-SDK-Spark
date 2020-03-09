import { MediaPlayer as WPEMediaPlayer, Log, Metrics, Lightning } from 'lightning-sdk'

export default class MediaPlayer extends WPEMediaPlayer {
  _construct(){
    super._construct()
    this._playSent = false
  }

  static _supportedEvents() {
    return ['onProgressUpdate', 'onEndOfStream'];
  }

  set textureMode(v) {
    return this._textureMode = v;
  }

  _init() {
    let proxyServer = "";
    if (sparkQueryParams && sparkQueryParams.sparkVideoProxyServer) {
      proxyServer = sparkQueryParams.sparkVideoProxyServer;
    }

    this.videoEl = sparkscene.create({
      t: "video",
      id: "video-player",
      proxy:proxyServer
    });

    var _this = this;
    sparkscene.on('onClose' , function(e) {
      _this.close();
    });

    this.eventHandlers = [];
  }

  _registerListeners() {
    MediaPlayer._supportedEvents().forEach(event => {
      const handler = e => {
        if (this._metrics[event] && typeof this._metrics[event] === 'function') {
          this._metrics[event]({ currentTime: this.videoEl.currentTime })
        }
        this.fire(event, { videoElement: this.videoEl, event: e })
      }
      this.eventHandlers.push(handler)
      this.videoEl.on(event, handler)
    })
  }

  _deregisterListeners() {
    Log.info('Deregistering event listeners MediaPlayer')
    MediaPlayer._supportedEvents().forEach((event, index) => {
      this.videoEl.delListener(event, this.eventHandlers[index])
    })
    this.eventHandlers = []
  }

  updateSettings(settings = {}) {
    return super.updateSettings(settings)
  }

  _setHide(hide) {
    this.videoEl.a = hide ? 0 : 1;
  }

  open(url, settings = { hide: false, videoPosition: null }) {
    this._playSent = false

    this._metrics = Metrics.media(url)
    Log.info('Playing stream', url)
    if (this.application.noVideo) {
      Log.info('noVideo option set, so ignoring: ' + url)
      return
    }
    if (this.videoEl.url === url) return this.reload()
    this.videoEl.url = url

    this._setHide(settings.hide)
    this._setVideoArea(settings.videoPosition || [0, 0, 1920, 1080])

    // if autoPlay, play is only called on init when url isn't yet set
    this.videoEl.play()
  }

  close() {
    this._playSent = false;
    this.videoEl.stop();
    this._clearSrc();
  }

  doPlay() {
    this.videoEl.speed = 1
  }

  doPause() {
    return super.doPause()
  }

  reload() {
    this._playSent = false;
    var url = this.videoEl.url;
    this.close();
    this.videoEl.url = url;

    // if autoPlay, play is only called on init when url isn't yet set
    this.videoEl.play()
  }

  getPosition() {
    return Promise.resolve(this.videoEl.position);
  }

  setPosition(pos) {
    this.videoEl.position = pos;
  }

  getDuration() {
    return super.getDuration()
  }

  seek(time, absolute = false) {
    if(absolute) {
      this.videoEl.position = time;
    }
    else {
      this.videoEl.setPositionRelative(time);
    }
  }

  _setVideoArea(videoPos) {
    if (Lightning.Utils.equalValues(this._videoPos, videoPos)) {
      return
    }

    this._videoPos = videoPos;

    if (this.textureMode) {
      this.videoTextureView.patch({
        smooth: {
          x: videoPos[0],
          y: videoPos[1],
          w: videoPos[2] - videoPos[0],
          h: videoPos[3] - videoPos[1]
        }
      });
    } else {
      const precision = this.stage.getRenderPrecision();
      this.videoEl.x = Math.round(videoPos[0] * precision) + 'px';
      this.videoEl.y = Math.round(videoPos[1] * precision) + 'px';
      this.videoEl.w = Math.round((videoPos[2] - videoPos[0]) * precision) + 'px';
      this.videoEl.h = Math.round((videoPos[3] - videoPos[1]) * precision) + 'px';
    }
  }

  error(args) {
    this._playSent = false;
    return super.error(args)
  }

  seeked() {
    this._fireConsumer('$mediaplayerSeeked', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
  }

  seeking() {
    this._fireConsumer('$mediaplayerSeeking', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
  }

  onEndOfStream(args) {
    this._fireConsumer('$mediaplayerEnded', args);
    this._setState("");
    this._playSent = false;
  }

  onProgressUpdate(args) {
    this._fireConsumer('$mediaplayerProgress', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
    if (this._playSent == false) {
      this._fireConsumer('$mediaplayerPlaying', args);
      this._playSent = true;
    }
  }
}
