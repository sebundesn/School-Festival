/** 通知音がまだ鳴らせないときに、画面のタップを促す表示。 */
export default function SoundOffNotice() {
  return (
    <p className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-full bg-red-600 px-5 py-3 text-lg font-bold text-white shadow-lg">
      🔇 画面をタップして通知音をオンにしてください
    </p>
  );
}
