import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import ReactDOMServer from 'react-dom/server';
import { db, database } from './firebase';
import { collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, set, onValue, push, get } from 'firebase/database';
import './App.css';

Modal.setAppElement('#root');

const photos = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  color: `hsl(${(index * 36) % 360}, 70%, 70%)`,
}));

// 날짜 포맷팅 함수 추가
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

function importAll(r) {
  let images = {};
  r.keys().forEach((item) => { images[item.replace('./', '')] = r(item); });
  return images;
}

// 이미지 파일만 가져오기
const images = importAll(require.context('./images', false, /\.(png|jpe?g|svg)$/));

// 갤러리 이미지 가져오기
const galleryImages = importAll(require.context('./images/gallery', false, /\.(png|jpe?g|svg)$/));

// 모달 스타일 설정
const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    width: '400px',
    height: '600px',
    overflow: 'hidden',
    border: 'none',
    borderRadius: '8px',
  },
};

// SVG X 버튼 컴포넌트
const CloseButton = ({ onClick }) => (
  <svg
    onClick={onClick}
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    fill="currentColor"
    className="bi bi-x-lg"
    viewBox="0 0 16 16"
    style={{ cursor: 'pointer', fill: '#333', position: 'absolute', top: '10px', right: '32px', zIndex: 10 }}
  >
    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
  </svg>
);

const PrevButton = ({ onClick }) => (
  <svg
    onClick={onClick}
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    fill="currentColor"
    className="bi bi-chevron-compact-left"
    viewBox="0 0 16 16"
    style={{
      cursor: 'pointer',
      position: 'absolute',
      left: '0px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      filter: 'drop-shadow(0 2px 4px rgba(255, 255, 255, 0.8))',
    }}
  >
    <path fillRule="evenodd" d="M9.224 1.553a.5.5 0 0 1 .223.67L6.56 8l2.888 5.776a.5.5 0 1 1-.894.448l-3-6a.5.5 0 0 1 0-.448l3-6a.5.5 0 0 1 .67-.223" />
  </svg>
);

const NextButton = ({ onClick }) => (
  <svg
    onClick={onClick}
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    fill="currentColor"
    className="bi bi-chevron-compact-right"
    viewBox="0 0 16 16"
    style={{
      cursor: 'pointer',
      position: 'absolute',
      right: '0px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      filter: 'drop-shadow(0 2px 4px rgba(255, 255, 255, 0.8))',
    }}
  >
    <path fillRule="evenodd" d="M6.776 1.553a.5.5 0 0 1 .671.223l3 6a.5.5 0 0 1 0 .448l-3 6a.5.5 0 1 1-.894-.448L9.44 8 6.553 2.224a.5.5 0 0 1 .223-.671" />
  </svg>
);

const calculateDaysUntilWedding = (weddingDate) => {
  const today = new Date();
  const wedding = new Date(weddingDate);
  const timeDiff = wedding - today; // 밀리초 단위 차이
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)); // 일 단위로 변환

  if (daysDiff > 0) {
    return `D-${daysDiff} 남았습니다.`; // 결혼식까지 남은 일수
  } else if (daysDiff === 0) {
    return '당일입니다.'; // 결혼식 당일
  } else {
    return `지났습니다.`; // 결혼식이 지난 경우
  }
};

const Calendar = ({ year, month }) => {
  const daysInMonth = new Date(year, month, 0).getDate(); // 해당 월의 일 수
  const firstDay = new Date(year, month - 1, 1).getDay(); // 해당 월의 첫 번째 날의 요일
  const weeks = [];

  // 빈 배열로 시작
  let week = Array(7).fill(null);

  // 첫 번째 주의 빈 칸 채우기
  for (let i = 0; i < firstDay; i++) {
    week[i] = null;
  }

  // 날짜 채우기
  for (let day = 1; day <= daysInMonth; day++) {
    week[(firstDay + day - 1) % 7] = day; // 요일에 맞춰 날짜 배치
    if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
      weeks.push(week); // 주가 끝나면 주 배열을 추가
      week = Array(7).fill(null); // 다음 주를 위한 빈 배열
    }
  }

  return (
    <div className="calendar fade-in-up">
      <div className="calendar-header">
        <div>{year}년 {month}월</div>
      </div>
      <div className="calendar-body">
        {weeks.map((week, index) => (
          <div className="calendar-week" key={index}>
            {week.map((day, dayIndex) => (
              <div key={dayIndex} className={`calendar-day ${day === 31 ? 'highlight' : ''}`}>
                {day}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const Map = () => {
  useEffect(() => {
    if (!window.kakao) {
      console.error("Kakao Maps API is not loaded.");
      return;
    }

    const container = document.getElementById('map'); // 지도를 표시할 div
    const options = {
      center: new window.kakao.maps.LatLng(37.42003166325095, 126.88917717756195), // 초기 위도, 경도
      level: 3, // 지도의 확대 레벨
    };

    const map = new window.kakao.maps.Map(container, options); // 지도 생성

    // 커스텀 마커를 위한 HTML 요소 생성
    const customMarker = document.createElement('div');
    customMarker.style.position = 'relative';
    customMarker.style.width = '80px'; // Increase width
    customMarker.style.height = '100px'; // Increase height
    customMarker.style.bottom = '-20px';

    // SVG Location Icon
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 24 30" fill="#000" stroke="none">
          <path d="M12 5C8.13 5 5 8.13 5 12c0 3.87 7 11 7 11s7-7.13 7-11c0-3.87-3.13-7-7-7z"/>
          <path d="M12 15c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2 2z"/>
        <!-- 다이아몬드(gem) 아이콘 추가 -->
        <g transform="translate(8,0) scale(0.5)">
          <path d="M3.1 0.2C3.14657 0.137902 3.20697 0.0875003 3.27639 0.0527864C3.34582 0.0180726 3.42238 0 3.5 0H12.5C12.5776 0 12.6542 0.0180726 12.7236 0.0527864C12.793 0.0875003 12.8534 0.137902 12.9 0.2L15.876 4.174C16.025 4.359 16.032 4.624 15.886 4.818L8.4 14.8C8.35343 14.8621 8.29303 14.9125 8.22361 14.9472C8.15418 14.9819 8.07762 15 8 15C7.92238 15 7.84582 14.9819 7.77639 14.9472C7.70697 14.9125 7.64657 14.8621 7.6 14.8L0.1 4.8C0.0350889 4.71345 0 4.60819 0 4.5C0 4.39181 0.0350889 4.28655 0.1 4.2L3.1 0.2Z" fill="black"/>
          <path d="M14.486 3.985L12.68 1.575L11.904 3.988L14.486 3.985Z" fill="#51ABFF"/>
          <path d="M10.853 3.989L11.814 1H4.186L5.149 3.995L10.853 3.989Z" fill="#51ABFF"/>
          <path d="M5.47 4.995L8 12.866L10.532 4.99L5.47 4.995Z" fill="#51ABFF"/>
          <path d="M4.099 3.996L3.319 1.574L1.501 3.999L4.099 3.996Z" fill="#51ABFF"/>
          <path d="M1.499 5L6.612 11.817L4.42 4.997L1.499 5Z" fill="#51ABFF"/>
          <path d="M9.388 11.817L14.511 4.987L11.583 4.989L9.388 11.817Z" fill="#51ABFF"/>
        </g>
      </svg>

    `;

    
    customMarker.innerHTML = svgIcon;


    // Circular Image
    const imageContainer = document.createElement('div');
    imageContainer.style.position = 'absolute';
    imageContainer.style.top = '40%'; // Adjust to position the image correctly
    imageContainer.style.left = '50%';
    imageContainer.style.transform = 'translate(-50%, -50%)'; // 중앙 정렬
    imageContainer.style.width = '36px'; // Increase image size
    imageContainer.style.height = '36px'; // Increase image size
    imageContainer.style.borderRadius = '50%'; // 동그라미 모양
    imageContainer.style.border = '2px solid #ffffff'; // 테두리 추가
    imageContainer.style.overflow = 'hidden'; // 이미지가 동그라미를 넘지 않도록

    const markerImage = document.createElement('img');
    markerImage.src = require('./images/marker.png'); // 마커 이미지 경로
    markerImage.style.width = '100%'; // 이미지 크기
    markerImage.style.height = '100%'; // 이미지 크기
    markerImage.style.objectFit = 'cover'; // 이미지 비율 유지

    imageContainer.appendChild(markerImage); // 이미지 추가
    customMarker.appendChild(imageContainer); // 커스텀 마커에 이미지 추가

    // 마커 위치 설정
    const markerPosition = new window.kakao.maps.LatLng(37.42003166325095, 126.88917717756195); // 마커 위치

    // 커스텀 마커를 지도에 추가
    const customOverlay = new window.kakao.maps.CustomOverlay({
      position: markerPosition,
      content: customMarker,
      yAnchor: 1, // 마커의 수직 앵커 설정
    });
    customOverlay.setMap(map); // 커스텀 오버레이를 지도에 표시
  }, []);

  return (
    <div id="map" style={{ width: '100%', height: '300px', margin: '20px 0' }}></div>
  );
};

// 꽃잎 SVG 컴포넌트
const FlowerPetal = ({ style }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    style={style}
  >
    <path
      d="M10 0 C13 3 15 7 15 10 C15 13 13 17 10 20 C7 17 5 13 5 10 C5 7 7 3 10 0"
      fill="rgba(255, 223, 236, 0.7)"
    />
  </svg>
);

// 복사 아이콘 컴포넌트 추가
const CopyIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    fill="currentColor" 
    className="bi bi-copy" 
    viewBox="0 0 16 16"
  >
    <path fillRule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
  </svg>
);

// 계좌번호 복사 함수 수정
const copyToClipboard = (text) => {
  // 하이픈 제거
  const cleanNumber = text.replace(/-/g, '');
  
  navigator.clipboard.writeText(cleanNumber)
    .then(() => {
      alert('계좌번호가 복사되었습니다.');
    })
    .catch(err => {
      console.error('복사 실패:', err);
    });
};

function App() {
  const [showInitialScreen, setShowInitialScreen] = useState(true);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState({
    relation: '모두에게',
    author: '',
    content: '',
    phone: '',
    password: ''
  });
  const [deleteInfo, setDeleteInfo] = useState({
    phone: '',
    password: '',
    id: ''
  });
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  const [editInfo, setEditInfo] = useState({
    phone: '',
    password: '',
    id: ''
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContents, setEditContents] = useState({
    author: '',
    content: '',
  });

  const [fadeInElements, setFadeInElements] = useState([]);

  const weddingDate = '2025-05-31'; // 결혼 날짜 설정
  const weddingStatus = calculateDaysUntilWedding(weddingDate);

  const [isPlaying, setIsPlaying] = useState(false); // 오디오가 재생되지 않도록 초기화
  const [isMuted, setIsMuted] = useState(false); 
  const [turnOnMusic, setTurnOnMusic] = useState(false);
  const audioRef = useRef(null); // 오디오 요소를 위한 ref

  const [isGroomOpen, setIsGroomOpen] = useState(false);
  const [isBrideOpen, setIsBrideOpen] = useState(false);

  const [showSpinner, setShowSpinner] = useState(true); // 스피너 표시 상태를 관리하는 state 추가

  const [lastPattern, setLastPattern] = useState(0); // 마지막 패턴 저장을 위한 변수 추가

  const [isClickable, setIsClickable] = useState(false);

  const [dragStart, setDragStart] = useState(null);

  const [showAllMessages, setShowAllMessages] = useState(false);

  const [messageFilter, setMessageFilter] = useState('모두');  // 필터 상태 추가

  const [scrollY, setScrollY] = useState(0);

  const openModal = (photo, index) => {
    // 모달 상태 업데이트
    setCurrentPhoto(photo);
    setCurrentPhotoIndex(index);
    setModalIsOpen(true);
    
    // 스크롤만 막기
    document.body.style.overflow = 'hidden';
  };

  const handleNext = () => {
    const nextIndex = (currentPhotoIndex + 1) % Object.keys(galleryImages).length;
    setCurrentPhoto(galleryImages[Object.keys(galleryImages)[nextIndex]]);
    setCurrentPhotoIndex(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = (currentPhotoIndex - 1 + Object.keys(galleryImages).length) % Object.keys(galleryImages).length;
    setCurrentPhoto(galleryImages[Object.keys(galleryImages)[prevIndex]]);
    setCurrentPhotoIndex(prevIndex);
  };

  const closeModal = () => {
    // 스크롤 다시 허용
    document.body.style.overflow = 'auto';
    setModalIsOpen(false);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    // 핸드폰 번호와 비밀번호 유효성 검사
    const phoneRegex = /^\d{11}$/; // 11자리 숫자 정규 표현식
    const passwordRegex = /^\d{4}$/; // 4자리 숫자 정규 표현식

    if (!newComment.author.trim() || !newComment.content.trim() || !newComment.phone.trim() || !newComment.password.trim()) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (!phoneRegex.test(newComment.phone)) {
      alert('핸드폰 번호는 11자리 숫자여야 합니다.');
      return;
    }

    if (!passwordRegex.test(newComment.password)) {
      alert('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    try {
      const commentsRef = ref(database, 'comments');
      const snapshot = await get(commentsRef);
      const commentCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      const newCommentId = `comment_${commentCount + 1}`;
      
      const newCommentRef = ref(database, `comments/${newCommentId}`);
      await set(newCommentRef, {
        ...newComment,
        timestamp: Date.now(),
        displayTime: formatDate(Date.now())
      });
      
      setNewComment({
        relation: '모두에게',
        author: '',
        content: '',
        phone: '',
        password: ''
      });
    } catch (error) {
      console.error("Error adding comment: ", error);
      alert('댓글 등록에 실패했습니다.');
    }
  };

  const handleEditComment = async (e) => {
    e.preventDefault();

    const commentsRef = ref(database, `comments/comment_${editInfo.id}`);
    const snapshot = await get(commentsRef);
    const commentData = snapshot.val();

    if (commentData) {
      // 핸드폰 번호와 비밀번호를 확인
      if (editInfo.phone === commentData.phone && editInfo.password === commentData.password) {
        await set(commentsRef, {
          ...commentData,
          author: editContents.author,
          content: editContents.content
        });
        alert('내용이 수정되었습니다.');
        setIsEditMode(false); // 수정 모드 종료
        setEditInfo({ phone: '', password: '', id: '' }); // 입력 필드 초기화
      } else {
        alert('휴대폰 번호 또는 비밀번호가 일치하지 않습니다.');
      }
    } else {
      alert('댓글을 찾을 수 없습니다.');
    }
  };

  const handleDeleteComment = async (e) => {
    e.preventDefault();

    const commentsRef = ref(database, `comments/comment_${deleteInfo.id}`);
    const snapshot = await get(commentsRef);
    const commentData = snapshot.val();

    if (commentData) {
      // 핸드폰 번호와 비밀번호를 확인
      if (deleteInfo.phone === commentData.phone && deleteInfo.password === commentData.password) {
        await set(commentsRef, null); // 댓글 삭제
        alert('댓글이 삭제되었습니다.');
        setIsDeleteMode(false); // 삭제 모드 종료
        setDeleteInfo({ phone: '', password: '', id: '' }); // 입력 필드 초기화
      } else {
        alert('휴대폰 번호 또는 비밀번호가 일치하지 않습니다.');
      }
    } else {
      alert('댓글을 찾을 수 없습니다.');
    }
  };

  // 스크롤 이벤트 핸들러
  const handleScroll = () => {
    const elements = document.querySelectorAll('.fade-in-up'); // 페이드 인 클래스를 가진 요소 선택
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        // 요소가 화면에 보일 때
        element.classList.remove('fade-out'); // 사라지는 클래스 제거
        element.classList.add('fade-in-up'); // 요소가 화면에 보일 때 클래스 추가
      } else {
        // 요소가 화면에서 사라질 때
        element.classList.add('fade-out'); // 사라지는 애니메이션 클래스 추가
      }
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll); // 스크롤 이벤트 리스너 추가
    return () => {
      window.removeEventListener('scroll', handleScroll); // 컴포넌트 언마운트 시 리스너 제거
    };
  }, []);

  useEffect(() => {
    const commentsRef = ref(database, 'comments');
    
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const commentsArray = Object.entries(data).map(([id, comment]) => ({
          id: parseInt(id.split('_')[1]), // comment_1 -> 1
          ...comment,
          displayTime: comment.displayTime || formatDate(comment.timestamp) // 이전 데이터 호환성
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
        setComments(commentsArray);
      } else {
        setComments([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 오디오 재생/일시정지 토글 함수
  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause(); // 오디오 일시정지
      setIsMuted(true);
    } else {
      audioRef.current.play(); // 오디오 재생
      setIsMuted(false);
    }
    setIsPlaying(!isPlaying); // 상태 토글
  };

  useEffect(() => {
    // 10초 후에 스피너를 숨김
    const timer = setTimeout(() => {
      setShowSpinner(false);
    }, 5000);

    // 컴포넌트가 언마운트될 때 타이머 정리
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const createPetal = () => {
      const petal = document.createElement('div');
      petal.className = 'flower-petal';
      
      // SVG 꽃잎 추가
      const svgString = ReactDOMServer.renderToString(
        <FlowerPetal style={{ width: '100%', height: '100%' }} />
      );
      petal.innerHTML = svgString;
      
      // 랜덤 시작 위치와 크기
      const startX = Math.random() * window.innerWidth;
      const size = 15 + Math.random() * 10;
      const duration = 9 + Math.random() * 4; // 9-13초로 수정
      const delay = Math.random() * 2; // 딜레이는 유지
      
      // 랜덤 움직임 패턴 선택
      const pattern = Math.random() < 0.5 
        ? 3  // 50% 확률로 직선 낙하
        : (lastPattern === 0 ? 1 : 0);  // 이전과 다른 패턴 선택
      
      // 마지막 패턴 저장을 위한 변수 추가 (컴포넌트 최상단에 추가)
      setLastPattern(pattern);
      
      // style을 cssText로 직접 설정
      petal.style.cssText = `
        left: ${startX}px;
        top: -${size}px;
        width: ${size}px;
        height: ${size}px;
        animation: flutter${pattern} ${duration}s linear ${delay}s;
        animation-delay: ${delay}s;
        z-index: 1000;
        transform: rotate(${Math.random() * 360}deg) scale(${pattern === 3 ? 0.8 : 1});
      `;
      
      document.body.appendChild(petal);
      
      // 애니메이션 종료 후 제거
      setTimeout(() => {
        petal.remove();
      }, (duration + delay) * 1000);
    };

    // 주기적으로 꽃잎 생성
    const interval = setInterval(createPetal, 600); // 300ms -> 600ms로 변경
    return () => clearInterval(interval);
  }, [lastPattern]);

  useEffect(() => {
    // 초기에 스크롤 막기
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
      setIsClickable(true);
    }, 5000);
  }, []);

  const handleDragStart = (e) => {
    setDragStart(e.clientX || e.touches[0].clientX);
  };

  const handleDragEnd = (e) => {
    if (!dragStart) return;
    
    const dragEnd = e.clientX || e.changedTouches[0].clientX;
    const diff = dragStart - dragEnd;
    const totalPhotos = Object.keys(galleryImages).length;
    const photoKeys = Object.keys(galleryImages);

    if (Math.abs(diff) > 50) {  // 50px 이상 드래그했을 때만 동작
      if (diff > 0) {  // 왼쪽으로 드래그
        if (currentPhotoIndex === totalPhotos - 1) {
          setCurrentPhotoIndex(0);
          setCurrentPhoto(galleryImages[photoKeys[0]]);  // 첫 번째 사진으로
        } else {
          handleNext();
        }
      } else {  // 오른쪽으로 드래그
        if (currentPhotoIndex === 0) {
          setCurrentPhotoIndex(totalPhotos - 1);
          setCurrentPhoto(galleryImages[photoKeys[totalPhotos - 1]]);  // 마지막 사진으로
        } else {
          handlePrev();
        }
      }
    }
    setDragStart(null);
  };

  // 필터링된 메시지 계산
  const filteredMessages = comments.filter(comment => 
    messageFilter === '모두' ? true : comment.relation === messageFilter
  );

  // 표시할 메시지 수 계산
  const displayedMessages = showAllMessages ? filteredMessages : filteredMessages.slice(0, 5);

  return (
    <div className="App">
      {showInitialScreen && (
        <div 
          onClick={() => {
            if (!isClickable) return;
            setShowInitialScreen(false);
            togglePlayPause();
            // 클릭 후 스크롤 허용
            document.body.style.overflow = 'auto';
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            backgroundColor: 'white',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            backgroundColor: 'rgb(0, 0, 0, 0.8)',
            cursor: isClickable ? 'pointer' : 'default'
          }}
        >
          <div style={{
            textAlign: 'center',
            fontFamily: 'Sue Ellen Francisco, cursive',
            color: 'white',
            padding: '20px'
          }}>
            <svg width="100%" height="300" viewBox="0 0 600 300" style={{overflow: 'visible'}}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <text className="svg-text" x="50%" y="20" textAnchor="middle" fill="white" fontSize="100">
                WELCOME
              </text>
              <text className="svg-text" x="50%" y="140" textAnchor="middle" fill="white" fontSize="100">
                TO OUR
              </text>
              <text className="svg-text" x="50%" y="260" textAnchor="middle" fill="white" fontSize="100">
                WEDDING
              </text>
            </svg>
            {showSpinner && ( // showSpinner 상태에 따라 조건부 렌더링
              <div className="text-center">
                <div className="spinner-border" role="status" style={{color: 'white', marginBottom: '40px'}}>
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}
            <h2 className="intro-text-touch">화면을 터치해주세요</h2>
            <br />
            <p className="intro-text-music">음악을 음소거하시려면 <br />우측 상단 스피커 아이콘을<br /> 클릭해주세요</p>
          </div>
        </div>
      )}
      
      <header className="header">
        <audio ref={audioRef} src={require('./bgm/track01.mp3')} loop />
        <div className="volume-switch" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-volume-mute" viewBox="0 0 16 16" onClick={togglePlayPause} style={{ cursor: 'pointer', color: 'white' }}>
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06M6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0" />
              
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-volume-up" viewBox="0 0 16 16" onClick={togglePlayPause} style={{ cursor: 'pointer', color: 'white' }}>
              <path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/>
              <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/>
              <path d="M10.025 8a4.5 4.5 0 0 1-1.318 3.182L8 10.475A3.5 3.5 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.5 4.5 0 0 1 10.025 8M7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11"/>
            </svg>
          )}
        </div>
        <div className="header-image" style={{ position: 'relative' }}>
          <img src={require('./images/main_01.JPG')} alt="Main" />
          <h1 className="overlay-text">save the date</h1>
        </div>
        <br />
        <br />
        <p className="wedding-bible fade-in-up">새 계명을 너희에게 <br /> 주노니 서로 사랑하라 <br /> 내가 너희를 사랑한 것 같이 <br /> 너희도 서로 사랑하라 <br /><br /> 요한복음 13:34 </p>
        <br /><br /><br />
        <p className="wedding-invite-title fade-in-up"> 소중한 분들을 초대합니다. </p>
        <br />
        <p className="wedding-invite-info fade-in-up"> 2021년 9월, 두 사람이 처음 만나 <br /> 2025년 5월, 결실을 맺습니다. <br /> 지금의 두 사람이 있기까지 함께해주시고 <br /> 성장을 지켜봐주신 모든 분들께 <br /> 감사의 인사를 드립니다. <br /><br /> 하나님 앞에서 부부로서 언약을 맺고 <br /> 예배하는 복된 자리에 <br /> 귀한 분들을 초대합니다.  </p>
        <br /><br /><br />
        <p className="wedding-info1 fade-in-up">김경오·김종임 의 <p style={{width: '60px', display: 'inline-block', margin: '0px', fontSize: '0.8em'}}>차남</p>  진영</p>
        <p className="wedding-info2 fade-in-up">정진수·김미란 의 <p style={{width: '60px', display: 'inline-block', margin: '0px', fontSize: '0.8em'}}>장녀</p>  하진</p>
        <br /><br /><br />
        <p className="wedding-location-title fade-in-up"> 예식안내 </p>
        <br />
        
        <Calendar year={2025} month={5} />
        <p className="wedding-dday fade-in-up">{weddingStatus}</p>
        <p className="wedding-date fade-in-up">2025 . 05 . 31 (토) 13:20 pm</p>
        <p className="wedding-location fade-in-up">광명무역센터컨벤션</p>
        <p className="wedding-address fade-in-up">경기도 광명시 일직로 72 광명무역센터 C동 3층 그랜드볼룸 <br /> (KTX광명역 안에 있는 웨딩홀과는 다른 곳입니다.)</p>
        <br />
        <p className="wedding-address fade-in-up" style={{textAlign:'left', paddingLeft:'10%'}}>연회장안내: 광명무역센터 C동 2층</p>
        <p className="wedding-address fade-in-up" style={{textAlign:'left', paddingLeft:'10%'}}>주차안내: 2시간 무료 (초과시 시간당 2000원) </p>
        <p className="wedding-address fade-in-up" style={{textAlign:'left', paddingLeft:'10%'}}>(B2/B3 주차 700석 데스크에서 노트북에 차량번호 입력) </p>
        <br /><br />

        <Map />
        <button className='naver-map' onClick={() => window.open('https://map.naver.com/v5/search/광명무역센터컨벤션', '_blank')}>네이버지도</button>
        <button className='kakao-map' onClick={() => window.open('https://map.kakao.com/?urlX=475477&urlY=1089087&urlLevel=3&itemId=491238215&q=%EA%B4%91%EB%AA%85%EB%AC%B4%EC%97%AD%EC%84%BC%ED%84%B0%EC%BB%A8%EB%B2%A4%EC%85%98&srcid=491238215&map_type=TYPE_MAP', '_blank')}>카카오지도</button>
        <br /><br />
      </header>

      <section className="photos">
        <h2 className="photos-title">갤러리 <span style={{fontSize: '0.6em',fontWeight: '200', color: '#555'}}>({Object.keys(galleryImages).length})</span></h2>
        <div className="photo-grid">
          {Object.keys(galleryImages).map((key, index) => (
            <div
              key={key}
              className="photo"
              style={{ backgroundImage: `url(${galleryImages[key]})` }}
              onClick={() => openModal(galleryImages[key], index)}
            />
          ))}
        </div>
      </section>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
      >

        
        <CloseButton onClick={closeModal} />
        <div 
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
        style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PrevButton onClick={handlePrev} />
          {currentPhoto && (
            <img 
              src={currentPhoto} 
              alt="Current" 
              style={{ width: '100%', height: 'auto', margin: '0', maxHeight: '80%', objectFit: 'contain' }}
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchEnd={handleDragEnd}
            />
          )}
          <NextButton onClick={handleNext} />
        </div>
        <div style={{ textAlign: 'center', marginTop: '-20px' }}>
          {`${currentPhotoIndex + 1} / ${Object.keys(galleryImages).length}`}
        </div>
      </Modal>

      <section className="comments">
        <h2 className="comments-title">축하 메시지</h2>
        
        {/* 필터 체크박스 추가 */}
        <div className="message-filters">
          {['모두', '신랑에게', '신부에게'].map((filter) => (
            <label key={filter} className="filter-label">
              <input
                type="radio"
                name="messageFilter"
                value={filter}
                checked={messageFilter === filter}
                onChange={(e) => setMessageFilter(e.target.value)}
                className="filter-radio"
              />
              {filter}
            </label>
          ))}
        </div>

        <div className="comment-list">
          {displayedMessages.map((comment) => (
            
            <div key={comment.id} className={`comment ${comment.relation}`}>
              <div className="comment-content">
                <div className="comment-header">
                  {isEditMode && editInfo.id === comment.id ? ( 
                    <form><input name='author' style={{width: '300px'}} value={editContents.author} onChange={(e) => setEditContents(prev => ({...prev, author: e.target.value }))}/></form> ) : ( <strong>{comment.author}</strong> 
                  )}
                  <div className="comment-relation">
                    <span className={`relation-dot ${comment.relation}`}></span>
                    {/* {comment.relation} */}
                  </div>
                </div>
                {isEditMode && editInfo.id === comment.id ? ( 
                    <form><textarea name='content' style={{width: '300px', height: '100px'}} value={editContents.content} onChange={(e) => setEditContents(prev => ({...prev, content: e.target.value }))}/></form> ) : ( <p>{comment.content}</p> 
                )}
                
                <div className="comment-footer">
                  <span className="comment-time">{comment.displayTime}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                    <button onClick={() => {
                      setIsEditMode(true);
                      setIsDeleteMode(false);
                      setEditInfo({ ...editInfo, id: comment.id }); // 수정할 댓글 ID 저장
                      setEditContents({author: comment.author, content: comment.content});
                    }} className="edit-button" style={{ background: 'none', border: 'none', color: '#999', marginRight: '10px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-pencil-square" viewBox="0 0 16 16">
                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                        <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                      </svg>
                    </button>
                    <button onClick={() => {
                      setIsDeleteMode(true);
                      setIsEditMode(false);
                      setDeleteInfo({ ...deleteInfo, id: comment.id }); // 삭제할 댓글 ID 저장
                    }} className="delete-button" style={{ background: 'none', border: 'none', color: '#999' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {isEditMode && editInfo.id === comment.id && ( // 삭제 모드일 때만 입력 필드와 버튼 표시
                <div className="edit-form">
                  <form onSubmit={handleEditComment}>
                    <input
                      type="text"
                      placeholder="휴대폰 번호"
                      value={editInfo.phone}
                      onChange={(e) => setEditInfo({ ...editInfo, phone: e.target.value })}
                      className="author-input"
                    />
                    <input
                      type="password"
                      placeholder="게시물 비밀번호"
                      value={editInfo.password}
                      onChange={(e) => setEditInfo({ ...editInfo, password: e.target.value })}
                      className="author-input"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button type="submit" className="edit-button" style={{ backgroundColor: '#58f', color: 'white', padding: '10px 20px', fontSize: '1em' }}>수정</button>
                      <button type="button" onClick={() => setIsEditMode(false)} className="cancel-button" style={{ marginLeft: '10px', backgroundColor: 'gray', color: 'white', padding: '10px 20px', fontSize: '1em' }}>취소</button>
                    </div>
                  </form>
                </div>
              )}
              {isDeleteMode && deleteInfo.id === comment.id && ( // 삭제 모드일 때만 입력 필드와 버튼 표시
                <div className="delete-form">
                  <form onSubmit={handleDeleteComment}>
                    <input
                      type="text"
                      placeholder="휴대폰 번호"
                      value={deleteInfo.phone}
                      onChange={(e) => setDeleteInfo({ ...deleteInfo, phone: e.target.value })}
                      className="author-input"
                    />
                    <input
                      type="password"
                      placeholder="게시물 비밀번호"
                      value={deleteInfo.password}
                      onChange={(e) => setDeleteInfo({ ...deleteInfo, password: e.target.value })}
                      className="author-input"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button type="submit" className="delete-button" style={{ backgroundColor: '#f55', color: 'white', padding: '10px 20px', fontSize: '1em' }}>삭제</button>
                      <button type="button" onClick={() => setIsDeleteMode(false)} className="cancel-button" style={{ marginLeft: '10px', backgroundColor: 'gray', color: 'white', padding: '10px 20px', fontSize: '1em' }}>취소</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}

          {/* 더보기/접기 버튼 */}
          {filteredMessages.length > 5 && (
            <button
              onClick={() => setShowAllMessages(!showAllMessages)}
              className="show-more-button"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #ddd',
                color: '#666',
                padding: '8px 16px',
                margin: '20px auto',
                display: 'block',
                cursor: 'pointer',
                borderRadius: '20px',
                fontSize: '0.9em'
              }}
            >
              {showAllMessages ? '접기' : `더보기 (${filteredMessages.length - 5}개)`}
            </button>
          )}
        </div>
        
        <form className="comment-form" onSubmit={handleSubmitComment}>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="relation"
                value="모두에게"
                checked={newComment.relation === "모두에게"}
                onChange={(e) => setNewComment(prev => ({
                  ...prev,
                  relation: e.target.value
                }))}
              />
              <span className="radio-dot all"></span>
              모두에게
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="relation"
                value="신랑에게"
                checked={newComment.relation === "신랑에게"}
                onChange={(e) => setNewComment(prev => ({
                  ...prev,
                  relation: e.target.value
                }))}
              />
              <span className="radio-dot groom"></span>
              신랑에게
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="relation"
                value="신부에게"
                checked={newComment.relation === "신부에게"}
                onChange={(e) => setNewComment(prev => ({
                  ...prev,
                  relation: e.target.value
                }))}
              />
              <span className="radio-dot bride"></span>
              신부에게
            </label>
          </div>
          <input
            type="text"
            value={newComment.author}
            onChange={(e) => setNewComment({ ...newComment, author: e.target.value })}
            placeholder="이름"
            required
            className="author-input"
          />
          <input
            type="tel"
            value={newComment.phone}
            onChange={(e) => {
              // 숫자만 입력 가능하고 11자리로 제한
              const value = e.target.value.replace(/\D/g, '').slice(0, 11);
              setNewComment({ ...newComment, phone: value });
            }}
            placeholder="전화번호"
            required
            className="author-input"
          />
          <input
            type="password"
            value={newComment.password}
            onChange={(e) => {
              // 숫자만 입력 가능하고 4자리로 제한
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              setNewComment({ ...newComment, password: value });
            }}
            placeholder="비밀번호 (4자리)"
            required
            className="author-input"
          />
          <textarea
            value={newComment.content}
            onChange={(e) => setNewComment({ ...newComment, content: e.target.value })}
            placeholder="축하 메시지를 남겨주세요"
            required
            className="content-textarea"
          />
          <div style={{fontSize: '0.7em', color: '#999'}}>수정과 삭제를위해 정확히 남겨주세요(분실시:신랑에게 문의)</div>
          <button type="submit" className="submit-button">메시지 남기기</button>
        </form>
      </section>

      <section className="donation">
        <h2 className="donation-title">축의금 안내</h2>
        
        {/* 신랑 측 계좌번호 */}
        <div className="account-section">
          <button 
            className="account-button"
            onClick={() => setIsGroomOpen(!isGroomOpen)}
            style={{
              width: '80%',
              padding: '15px',
              margin: '10px 0',
              backgroundColor: '#f4edef',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            신랑 측 계좌번호 보기
          </button>
          
          <div 
            style={{
              maxHeight: isGroomOpen ? '500px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease-in-out',
              backgroundColor: '#f9f9f9',
              padding: isGroomOpen ? '15px' : '0',
              borderRadius: '5px'
            }}
          >
            <div className="account-row">
              <p className="account-info">신랑: 246602-04-232623 (국민 김진영)</p>
              <button 
                onClick={() => copyToClipboard('246602-04-232623')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
            <div className="account-row">
              <p className="account-info">신랑 부: 123-456-7890 (국민 홍판서)</p>
              <button 
                onClick={() => copyToClipboard('123-456-7890')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
            <div className="account-row">
              <p className="account-info">신랑 모: 123-456-7890 (신한 홍여사)</p>
              <button 
                onClick={() => copyToClipboard('123-456-7890')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        </div>

        {/* 신부 측 계좌번호 */}
        <div className="account-section">
          <button 
            className="account-button"
            onClick={() => setIsBrideOpen(!isBrideOpen)}
            style={{
              width: '80%',
              padding: '15px',
              margin: '10px 0',
              backgroundColor: '#f4edef',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            신부 측 계좌번호 보기
          </button>
          
          <div 
            style={{
              maxHeight: isBrideOpen ? '500px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease-in-out',
              backgroundColor: '#f9f9f9',
              padding: isBrideOpen ? '15px' : '0',
              borderRadius: '5px'
            }}
          >
            <div className="account-row">
              <p className="account-info">신부: 098-765-4321 (우리 김길동)</p>
              <button 
                onClick={() => copyToClipboard('098-765-4321')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
            <div className="account-row">
              <p className="account-info">신부 부: 098-765-4321 (하나 김판서)</p>
              <button 
                onClick={() => copyToClipboard('098-765-4321')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
            <div className="account-row">
              <p className="account-info">신부 모: 098-765-4321 (기업 김여사)</p>
              <button 
                onClick={() => copyToClipboard('098-765-4321')}
                className="copy-button"
                title="계좌번호 복사"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

export default App;