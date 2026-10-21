#!/usr/bin/env bash
set -e
cd "/c/Users/岳思雨/WorkBuddy/2026-10-16-21-24-30/yujiacha/demo/videos"
FF="/c/Users/岳思雨/.workbuddy/binaries/python/envs/default/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
B="/c/Users/岳思雨/OneDrive/桌面/鱼价查_四端功能截图"
"$FF" -y -hide_banner -loglevel error \
  -i "$B/鱼价查—小程序功能演示.mp4" \
  -i "$B/鱼价查_网页功能演示.mp4" \
  -i "$B/鱼价查—管理后台功能演示.mp4" \
  -f lavfi -t 112 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,fade=t=in:st=0:d=0.5[v0];[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,fade=t=in:st=0:d=0.5[v1];[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,fade=t=in:st=0:d=0.5,fade=t=out:st=136.8:d=1.0[v2];[2:a]aformat=sample_rates=48000:channel_layouts=stereo,afade=t=out:st=136.3:d=1.5[a2];[3:a]atrim=0:111.8,asetpts=N/SR/TB[a1];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vc][ac];[vc]subtitles=subs.ass[vout]" \
  -map "[vout]" -map "[ac]" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart merged_final.mp4
cp merged_final.mp4 "$B/鱼价查_四端功能演示_合并.mp4"
echo FINAL_OK
