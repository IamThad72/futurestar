<template>
  <ul role="list" class="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
    <li v-for="entity in entities" 
               :key="entity.email" 
               class="col-span-1 flex flex-col divide-y divide-neutral rounded-lg bg-base-200/10 text-center border shadow-md">
      <div class="flex grow  border-neutral rounded-t-lg">
        
        
        <!-- <div class="pt-1 pl-1 pb-1 flex items-start justify-start w-36 lg:w-32">
          <img 
            class="w-24 h-24 lg:h-20 lg:w-20 shrink-0 rounded-full " 
            :src="entity.imageUrl" 
            alt="" 
          />
          
        </div> -->
        <div class="pt-1 pl-1 pb-4 flex items-start justify-start w-[158px] lg:w-[154px]">
          <div class="avatar indicator">
            <span class="ml-1 font-semibold indicator-item badge badge-md badge-primary badge-outline indicator-bottom indicator-end mb-2 p-1 border-2 bg-base-300">{{entity.position}}</span>
            <div class="pt-1 pl-1 pb-1 flex items-start justify-start w-20 h-20 lg:h-20 lg:w-20">
              <img 
                class="shrink-0 rounded-full " 
                :src="entity.imageUrl" 
                alt="" 
              />
            </div>
          </div>
          
        </div>
        
        <div class="w-full p-0">
           <div class="truncate w-[80%] justify-items-start text-sm font-semibold text-base-content">{{entity.name}}</div>
           <div class="truncate w-[80%] justify-items-start text-sm font-semibold text-primary">{{entity.team}}</div>
          <div class="flex  truncate pl-0.5 text-sm font-semibold justify-between">
            <div class="pr-0.5">open:<span class="pl-0.5 text-success">${{entity.openPrice}}</span></div>
            <div>g/l:<span class="pl-0.5 text-success">{{entity.currentPrice-entity.openPrice}}</span></div>
            <div class="pr-0.5">close:<span class="pl-0.5 text-success">${{entity.closePrice}}</span></div>
            
          </div>
          
          
          
        </div>
        
      </div>
      
      
      <div>
        <div class="-mt-px flex divide-x divide-neutral px-0">
          <div class="flex w-0 flex-1 justify-center">
            
            <button class="btn btn-link no-underline hover:text-decoration-none text-base-content" style="text-decoration: none" onclick="buySellModal.showModal()"><PlusCircleIcon class="size-5 text-success" aria-hidden="true"/>BUY</button>
          </div>
          <div class="flex w-0 flex-1 justify-center">
           
            <button class="btn btn-link no-underline hover:text-decoration-none text-base-content" style="text-decoration: none" onclick="buySellModal.showModal()"><MinusCircleIcon class="size-5 text-success" aria-hidden="true"/>SELL</button>
          </div>
        </div>
        <dialog id="my_modal_1" class="modal">
          <div class="modal-box">
            <h3 class="text-lg font-bold">Hello!</h3>
            <p class="py-4">Press ESC key or click the button below to close</p>
            <div class="modal-action">
              <form method="dialog">
                <!-- if there is a button in form, it will close the modal -->
                <button class="btn">Close</button>
              </form>
            </div>
          </div>
        </dialog>
      </div>
    </li>
  </ul>
  <dialog id="buySellModal" class="modal">
    <div class="modal-box">
      <form method="dialog">
       
        <button class="btn btn-square btn-outline absolute right-2 top-2 text-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </form>
      <h3 class="text-lg font-bold">Hello!</h3>
      <p class="py-4">Press ESC key or click on ✕ button to close</p>
    </div>
  </dialog>

</template>

<script setup>
 import { ref } from 'vue';
 import { EnvelopeIcon, PhoneIcon, PlusCircleIcon, MinusCircleIcon, XCircleIcon } from '@heroicons/vue/20/solid'
const selectedEntity = ref({});

// Method to set the selected person and open the modal
const selectEntity = (entity) => {
  selectedEntity.value = entity;
  const modal = document.getElementById('entityModal');
  modal.showModal();
};

    const entities = [
      {
        name: 'Entity1',
        height: "heightxx",
        weigth: "weightxx",
        age: "agexx",
        team: 'Team1',
        position: 'P1',
        currentPrice: '1.00',
        openPrice: '1.00',
        closePrice: '1.00',
        imageUrl:
          '/images/blankAvatar.jpg',
      },
      {
        name: 'Entity2',
        height: "heightxx",
        weigth: "weightxx",
        age: "agexx",
        team: 'Team2',
        position: 'WR',
        currentPrice: '1.00',
        openPrice: '1.00',
        closePrice: '1.00',
        imageUrl:
          '/images/blankAvatar.jpg',
      },
      {
        name: 'Baker Mayfield',
        height: "heightxx",
        weigth: "weightxx",
        age: "agexx",
        team: 'Tampa Bay Buccaneers',
        position: 'QB',
        currentPrice: 3.45,
        openPrice: 1.00,
        closePrice: 3.45,
        imageUrl:
          '/images/blankAvatar.jpg',
      },
      // More people...
    ]
  </script>