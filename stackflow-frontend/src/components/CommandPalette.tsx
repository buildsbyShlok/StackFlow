import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { searchWorkspace } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import type { SearchItem } from "@/types";
import { Modal } from "./common";
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<(SearchItem & { group: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchWorkspace(query, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setItems(
              Object.entries(result).flatMap(([group, entries]) =>
                entries.map((item) => ({ ...item, group })),
              ),
            );
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(errorMessage(e));
            setLoading(false);
          }
        });
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);
  const open = (item: SearchItem) => {
    navigate(item.url);
    onClose();
  };
  return (
    <Modal
      title="Search your workspace"
      description="Projects, milestones, tasks and people. Use the arrow keys to choose a result."
      onClose={onClose}
    >
      <div className="search-field">
        <Search size={16} />
        <input
          autoFocus
          value={query}
          placeholder="Search by name…"
          aria-label="Search workspace"
          aria-controls="search-results"
          aria-activedescendant={
            items[active] ? "search-result-" + active : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setItems([]);
            setLoading(e.target.value.trim().length >= 2);
            setError("");
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) =>
                Math.max(
                  0,
                  Math.min(
                    items.length - 1,
                    a + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              open(items[active]);
            }
          }}
        />
      </div>
      <div className="search-results" id="search-results">
        {error ? (
          <p role="alert">{error}</p>
        ) : loading ? (
          <p role="status">Searching…</p>
        ) : items.length ? (
          items.map((item, index) => (
            <button
              id={"search-result-" + index}
              key={item.group + item.id}
              className={
                "search-result " + (active === index ? "selected" : "")
              }
              onClick={() => open(item)}
              onFocus={() => setActive(index)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
              <span className="eyebrow">{item.group}</span>
            </button>
          ))
        ) : (
          <p>
            {query.trim().length < 2
              ? "Type at least two characters."
              : "No results. Try another name."}
          </p>
        )}
      </div>
      <div className="search-help">
        <span>↑ ↓ Navigate</span>
        <span>Enter Open</span>
        <span>Esc Close</span>
      </div>
    </Modal>
  );
}
