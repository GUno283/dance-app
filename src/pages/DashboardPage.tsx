import React from 'react';
import { currentUser, mockProjects } from '../data/mockData';
import { FiCheckCircle, FiBell, FiCalendar, FiMapPin } from 'react-icons/fi';
import styles from './DashboardPage.module.css';

const DashboardPage: React.FC = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{currentUser.name} のダッシュボード</h1>
        <p className={styles.date}>{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <FiCheckCircle className={styles.iconSuccess} />
            <h2>今日やること</h2>
          </div>
          <ul className={styles.list}>
            <li>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" />
                <span>Opening HIPHOP 振り入れ確認</span>
              </label>
            </li>
            <li>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" />
                <span>夏合宿の出欠入力</span>
                <span className={styles.tagDanger}>締切明日</span>
              </label>
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <FiCalendar className={styles.iconPrimary} />
            <h2>次の練習</h2>
          </div>
          <div className={styles.practiceInfo}>
            <div className={styles.practiceTime}>今日 18:00 - 20:00</div>
            <div className={styles.practiceTitle}>Opening HIPHOP</div>
            <div className={styles.practiceLocation}><FiMapPin /> 体育館 第2アリーナ</div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <FiBell className={styles.iconWarning} />
            <h2>未確認のお知らせ</h2>
          </div>
          <ul className={styles.list}>
            <li className={styles.newsItem}>
              <span className={styles.tagWarning}>重要</span>
              <p>衣装代の集金について</p>
            </li>
            <li className={styles.newsItem}>
              <span className={styles.tagInfo}>お知らせ</span>
              <p>M2 JAZZのフォーメーションが更新されました</p>
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <FiMapPin className={styles.iconPrimary} />
            <h2>参加プロジェクト</h2>
          </div>
          <ul className={styles.projectList}>
            {mockProjects.filter(p => p.memberIds.includes(currentUser.id)).map(p => (
              <li key={p.id} className={styles.projectItem}>
                <div className={styles.projectTitle}>{p.title}</div>
                <div className={styles.projectMeta}>{p.genre} • {p.practiceSchedule}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
export default DashboardPage;
