export default function LoadingSpinner({ size = 40, message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div
        style={{
          width: size,
          height: size,
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "hsl(249,90%,62%)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
