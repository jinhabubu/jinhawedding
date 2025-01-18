import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import ReactDOMServer from 'react-dom/server';
import { db } from './firebase';
import { collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import './App.css';

Modal.setAppElement('#root');

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
      transform="rotate(45, 10, 10)"
    />
  </svg>
);

const photos = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  color: `hsl(${(index * 36) % 360}, 70%, 70%)`,
}));

function App() {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [comments, setComments] = useState([
    { id: 1, relation: '신랑에게', author: '홍길동', content: '축하합니다!' },
    { id: 2, relation: '신부에게', author: '김영희', content: '행복하세요!' },
    { id: 3, relation: '모두에게', author: '이순신', content: '결혼 축하드립니다!' },
  ]);
  const [newComment, setNewComment] = useState({
    relation: '모두에게',
    author: '',
    content: ''
  });

  const openModal = (photo) => {
    setCurrentPhoto(photo);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setCurrentPhoto(null);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.author.trim() || !newComment.content.trim()) {
      alert('이름과 내용을 모두 입력해주세요.');
      return;
    }
    
    try {
      await addDoc(collection(db, "comments"), {
        ...newComment,
        timestamp: new Date(),
      });
      
      setNewComment(prev => ({
        ...prev,
        author: '',
        content: ''
      }));
    } catch (error) {
      console.error("Error adding comment: ", error);
      alert('댓글 등록에 실패했습니다.');
    }
  };

  useEffect(() => {
    // 꽃잎을 담을 별도의 컨테이너 생성
    const petalContainer = document.createElement('div');
    petalContainer.className = 'petal-container';
    document.body.appendChild(petalContainer);

    // 꽃잎 풀 생성
    const petalPool = Array.from({ length: 20 }, () => {
      const petal = document.createElement('div');
      petal.className = 'flower-petal';
      petal.style.position = 'fixed'; // absolute 대신 fixed 사용
      petal.style.zIndex = '1'; // 모달(z-index: 9999)보다 낮은 값으로 설정
      petal.style.display = 'none';
      
      // SVG 꽃잎 렌더링
      const svgString = ReactDOMServer.renderToString(
        <FlowerPetal style={{ 
          width: '100%', 
          height: '100%',
        }} />
      );
      petal.innerHTML = svgString;
      petalContainer.appendChild(petal); // App 대신 petalContainer에 추가
      return petal;
    });

    let availablePetals = [...petalPool];

    const createPetal = () => {
      if (availablePetals.length === 0) return;

      const petal = availablePetals.pop();
      const size = Math.random() * 15 + 10;
      
      petal.style.display = 'block';
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.top = '-30px';
      petal.style.width = `${size}px`;
      petal.style.height = `${size}px`;

      // photos 섹션까지의 거리 계산
      const photos = document.querySelector('.photos');
      const photosDistance = photos ? photos.offsetTop : window.innerHeight;
      const duration = 8;

      // 애니메이션 최적화 - 더 자연스러운 회전 추가
      const startRotation = Math.random() * 360;
      const rotationAmount = Math.random() * 720 - 360; // -360도에서 360도 사이의 회전

      const animation = petal.animate([
        { 
          transform: `translate3d(0, 0, 0) rotate(${startRotation}deg)`,
          opacity: 1 
        },
        { 
          transform: `translate3d(${Math.random() * 200 - 100}px, ${photosDistance}px, 0) rotate(${startRotation + rotationAmount}deg)`,
          opacity: 0
        }
      ], {
        duration: duration * 1000,
        easing: 'cubic-bezier(0.37, 0, 0.63, 1)', // 더 자연스러운 이징
        fill: 'forwards'
      });

      // 애니메이션 완료 후 꽃잎 재사용
      animation.onfinish = () => {
        petal.style.display = 'none';
        availablePetals.push(petal);
      };
    };

    // 꽃잎 생성 간격 조정
    const interval = setInterval(createPetal, 500);

    // 클린업
    return () => {
      clearInterval(interval);
      petalContainer.remove();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="App">
      <header className="header">
        <div className="header-image">사진</div>
        <h1>예식 안내</h1>
        <p>여기에 예식 안내 글을 작성하세요.</p>
      </header>

      <section className="photos">
        <h2>Photos</h2>
        <div className="photo-grid">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="photo"
              style={{ backgroundColor: photo.color }}
              onClick={() => openModal(photo)}
            />
          ))}
        </div>
      </section>

      <Modal isOpen={modalIsOpen} onRequestClose={closeModal} className="modal">
        <button onClick={closeModal} className="close-button">X</button>
        {currentPhoto && (
          <div className="modal-content" style={{ backgroundColor: currentPhoto.color }}>
            {`Photo ID: ${currentPhoto.id}`}
          </div>
        )}
      </Modal>

      <section className="comments">
        <h2>축하 메시지</h2>
        <div className="comment-list">
          {comments.map((comment) => (
            <div key={comment.id} className={`comment ${comment.relation}`}>
              <div className="comment-relation">
                <span className="relation-dot"></span>
                {comment.relation}
              </div>
              <div className="comment-content">
                <strong>{comment.author}</strong>
                <p>{comment.content}</p>
              </div>
            </div>
          ))}
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
            placeholder="작성자"
            value={newComment.author}
            onChange={(e) => setNewComment(prev => ({
              ...prev,
              author: e.target.value
            }))}
            className="author-input"
          />
          <textarea
            placeholder="축하 메시지를 남겨주세요"
            value={newComment.content}
            onChange={(e) => setNewComment(prev => ({
              ...prev,
              content: e.target.value
            }))}
            className="content-textarea"
          />
          <button type="submit" className="submit-button">메시지 남기기</button>
        </form>
      </section>

      <section className="donation">
        <h2>축의금 안내</h2>
        <p>신랑 계좌: 123-456-7890</p>
        <p>신부 계좌: 098-765-4321</p>
      </section>
    </div>
  );
}

export default App;