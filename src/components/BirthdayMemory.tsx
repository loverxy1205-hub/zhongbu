import { useState } from "react";
import {
  birthdayValidationError,
  forgetBirthdayMemory,
  readBirthdayMemory,
  saveBirthdayMemory,
} from "../lib/birthdayMemory";
import { todayLocal } from "../lib/dates";
import "../birthday-memory.css";

export function BirthdayMemory({
  birthday,
  today = todayLocal(),
  onForgot,
}: {
  birthday: string;
  today?: string;
  onForgot?: () => void;
}) {
  const [initial] = useState(() => readBirthdayMemory(undefined, today));
  const [remembered, setRemembered] = useState(initial.value);
  const [notice, setNotice] = useState(initial.error ?? "");
  const [dismissed, setDismissed] = useState(false);
  const invalid = birthdayValidationError(birthday, today);
  function save() {
    const error = saveBirthdayMemory(birthday, undefined, today);
    setNotice(error ?? "已记住，下次在此浏览器会自动填入。 ");
    if (!error) setRemembered(birthday);
  }
  function forget() {
    const error = forgetBirthdayMemory();
    setNotice(error ?? "已忘记保存的生日。");
    if (!error) {
      setRemembered(null);
      setDismissed(true);
      onForgot?.();
    }
  }
  return (
    <div className="birthday-memory" data-testid="birthday-memory">
      {remembered ? (
        <>
          <p>已在此浏览器记住生日。</p>
          <div className="birthday-memory-actions">
            {birthday !== remembered && (
              <button type="button" disabled={!!invalid} onClick={save}>
                同意改为当前生日
              </button>
            )}
            <button type="button" className="subtle" onClick={forget}>
              忘记保存的生日
            </button>
          </div>
        </>
      ) : !dismissed ? (
        <>
          <p>
            要在这台设备记住生日吗？仅保存在此浏览器，下次自动填入，可随时删除。
          </p>
          <div className="birthday-memory-actions">
            <button type="button" disabled={!!invalid} onClick={save}>
              同意保存生日
            </button>
            <button
              type="button"
              className="subtle"
              onClick={() => {
                setDismissed(true);
                setNotice("本次不保存生日。");
              }}
            >
              这次不保存
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="subtle"
          onClick={() => {
            setDismissed(false);
            setNotice("");
          }}
        >
          设置生日记忆
        </button>
      )}
      {initial.error && !remembered && (
        <button type="button" className="subtle" onClick={forget}>
          忘记已存生日
        </button>
      )}
      {notice && (
        <p role="status" className="birthday-memory-notice">
          {notice}
        </p>
      )}
    </div>
  );
}
