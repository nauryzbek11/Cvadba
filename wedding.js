// Заполните данные позже. Дата должна содержать часовой пояс, например 2027-06-19T17:00:00+05:00.
window.WEDDING = {
  names: ['Самат', 'Балнұр'],
  initials: 'С & Б',
  date: '2026-10-25T18:00:00+05:00',
  host: 'Тоғжан',
  venue: { name: '«Астана» тойханасы', address: 'Қызылорда, Осербаева көшесі, 4', mapUrl: 'https://2gis.kz/kyzylorda/geo/70000001062787967' },
  // Укажите пути к собственным файлам, например assets/portrait.jpg.
  photos: {
    hero: 'assets/wedding-rings.png',
    portrait: 'assets/wedding-hands.png',
    storyOne: 'assets/wedding-rings.png',
    storyTwo: 'assets/wedding-hands.png',
    venue: 'assets/wedding-table.png',
    second: 'assets/wedding-table.png',
    final: 'assets/wedding-rings.png'
  },
  // Ваше видео на общем заднем фоне, без звука, с повтором.
  backgroundVideo: 'assets/video/background.mp4',
  // Автозапуск при загрузке; если браузер блокирует звук — после первого касания.
  music: 'assets/audio/music (2).mp3',
  // События: { time: '16:30', title: 'Қонақтарды қарсы алу' }
  schedule: [
    { time: '17:00', title: 'Беташар' },
    { time: '18:00', title: 'Той уақыты' }
  ],
  // URL обработчика POST JSON. Без него ответы хранятся только в браузере гостя.
  rsvpEndpoint: '/api/rsvp'
};
