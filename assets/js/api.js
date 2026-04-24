const API_BASE_URL = '/api/proxy';

async function callApi(action, data = {}) {
  console.log('callApi called with', action, data);
  
  // Mock data for demo
  switch (action) {
    case 'getAdminData':
      return mockGetAdminData(data);
    case 'getHewan':
      return mockGetHewan(data);
    case 'getDokumentasi':
      return mockGetDokumentasi(data);
    case 'uploadFoto':
      return { success: true, fileUrl: 'https://example.com/mock.jpg' };
    case 'uploadDokumentasi':
      return { success: true, fotoCount: 1, videoCount: 0 };
    case 'addHewan':
    case 'updateHewan':
    case 'deleteHewan':
    case 'addUser':
    case 'updateUser':
    case 'deleteUser':
      return { success: true };
    default:
      return { success: true };
  }
}

function mockGetAdminData(data) {
  const mockUsers = [
    { email: 'admin@example.com', username: 'Admin', role: 'admin' },
    { email: 'panitia@example.com', username: 'Panitia 1', role: 'user' },
    { email: 'panitia2@example.com', username: 'Panitia 2', role: 'user' }
  ];
  
  const mockHewan = [];
  for (let i = 1; i <= 10; i++) {
    mockHewan.push({
      nomor_hewan: `H${i.toString().padStart(3, '0')}`,
      jenis_hewan: i % 2 === 0 ? 'Sapi' : 'Kambing',
      daftar_pekurban: `Pekurban ${i}`,
      jumlah_pekurban: Math.floor(Math.random() * 3) + 1,
      instansi: `Instansi ${i % 3 + 1}`,
      wilayah: `Wilayah ${i % 2 + 1}`,
      status: {
        url_hidup: i > 5 ? 'https://via.placeholder.com/300x200?text=Hidup' : '',
        url_ditumbangkan: i > 7 ? 'https://via.placeholder.com/300x200?text=Ditumbangkan' : '',
        url_mati: i > 8 ? 'https://via.placeholder.com/300x200?text=Mati' : ''
      },
      progress: (i > 5 ? 1 : 0) + (i > 7 ? 1 : 0) + (i > 8 ? 1 : 0)
    });
  }
  
  const selesai = mockHewan.filter(h => h.progress === 3).length;
  
  return {
    success: true,
    users: mockUsers,
    hewan: mockHewan,
    stats: { totalHewan: mockHewan.length, totalUsers: mockUsers.length, selesai }
  };
}