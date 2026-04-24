const API_BASE_URL = '/api/proxy';

async function callApi(action, data = {}) {
  console.log('callApi called with', action, data);
  // Mock API for local development
  console.log('Mock API call:', action, data);
  
  switch (action) {
    case 'getHewan':
      return mockGetHewan(data);
    case 'getDokumentasi':
      return mockGetDokumentasi(data);
    case 'uploadFoto':
      return { success: true, fileUrl: 'https://example.com/mock.jpg' };
    case 'uploadDokumentasi':
      return { success: true, fotoCount: 1, videoCount: 0 };
    default:
      return { success: true };
  }
}

function mockGetHewan(data) {
  const names = [
    'Ahmad Rahman', 'Siti Nurhaliza', 'Muhammad Ali', 'Fatimah Zahra', 'Hassan bin Abdullah',
    'Aisyah binti Umar', 'Omar bin Khattab', 'Khadijah binti Khuwaylid', 'Abu Bakar', 'Umar bin Abdul Aziz',
    'Zainab binti Jahsh', 'Abdullah bin Abbas', 'Asma binti Abu Bakar', 'Ali bin Abi Talib', 'Umm Salamah'
  ];
  const mockHewan = [];
  for (let i = 1; i <= 10; i++) {
    const jumlah = Math.floor(Math.random() * 3) + 1;
    const selectedNames = [];
    for (let j = 0; j < jumlah; j++) {
      selectedNames.push(names[(i + j) % names.length]);
    }
    mockHewan.push({
      nomor_hewan: `H${i.toString().padStart(3, '0')}`,
      jenis_hewan: i % 2 === 0 ? 'Sapi' : 'Kambing',
      daftar_pekurban: selectedNames.join(', '),
      jumlah_pekurban: jumlah,
      instansi: `Instansi ${i % 3 + 1}`,
      wilayah: `Wilayah ${i % 2 + 1}`,
      status: {
        url_hidup: i > 5 ? 'https://via.placeholder.com/300x200?text=Hidup' : '',
        url_ditumbangkan: i > 7 ? 'https://via.placeholder.com/300x200?text=Ditumbangkan' : '',
        url_mati: i > 8 ? 'https://via.placeholder.com/300x200?text=Mati' : ''
      }
    });
  }
  return { success: true, data: mockHewan };
}

function mockGetDokumentasi(data) {
  const mockDok = [];
  for (let i = 1; i <= 5; i++) {
    mockDok.push({
      instansi: `Instansi ${i}`,
      wilayah: `Wilayah ${i % 2 + 1}`,
      jenis: i % 2 === 0 ? 'Pencacahan' : 'Penyaluran',
      folderUrl: 'https://drive.google.com/mock',
      tglUpload: new Date().toISOString(),
      uploader: 'Mock User',
      catatan: 'Data dummy untuk testing'
    });
  }
  return { success: true, data: mockDok };
}

function checkAuth() {
  // Mock auth for demo purposes
  return { email: 'demo@example.com', role: 'user', username: 'Demo User' };
}